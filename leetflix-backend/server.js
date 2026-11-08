const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const admin = require('firebase-admin');
const cors = require('cors');
const compression = require('compression');
const bcrypt = require('bcryptjs');

let serviceAccount;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        serviceAccount = require('./serviceAccountKey.json');
    }
} catch (error) {
    console.error('--- FATAL ERROR: Could not load or parse serviceAccountKey / FIREBASE_SERVICE_ACCOUNT env var ---\nDetailed Error:', error.message);
    // Don't crash immediately on load in serverless if env vars are being configured
}

if (serviceAccount && !admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.apps.length ? admin.firestore() : null;
const app = express();
const PORT = process.env.PORT || 3001;

const ADMIN_KEY = process.env.ADMIN_KEY || 'your-secret-admin-key';

// --- High-Performance In-Memory Cache Layer ---
let cachedShowsList = null;
let cachedShowsListExpiry = 0;
const cachedQuizMap = new Map();
const cachedLeaderboards = new Map();
let cachedGlobalLeaderboard = null;
let cachedGlobalLeaderboardExpiry = 0;

function invalidateShowsCache() {
    cachedShowsList = null;
    cachedShowsListExpiry = 0;
    cachedQuizMap.clear();
}

function invalidateScoreCaches(showName) {
    if (showName) {
        cachedLeaderboards.delete(showName.trim().toLowerCase());
    } else {
        cachedLeaderboards.clear();
    }
    cachedGlobalLeaderboard = null;
    cachedGlobalLeaderboardExpiry = 0;
}

// Enable response compression (gzip / brotli) for all responses
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Middleware to ensure DB is initialized
app.use((req, res, next) => {
    if (!db) {
        return res.status(500).json({ message: 'Firebase DB not initialized. Please configure FIREBASE_SERVICE_ACCOUNT or serviceAccountKey.json.' });
    }
    next();
});

// Helper: sort seasons numerically (e.g. "Season 10" before "Season 9" alphabetically).
function sortSeasons(seasons) {
    return seasons.sort((a, b) => {
        const aMatch = (a.seasonName || '').match(/\d+/);
        const bMatch = (b.seasonName || '').match(/\d+/);
        const aNum = aMatch ? parseInt(aMatch[0], 10) : null;
        const bNum = bMatch ? parseInt(bMatch[0], 10) : null;
        if (aNum !== null && bNum !== null) return aNum - bNum;
        if (aNum !== null) return -1;
        if (bNum !== null) return 1;
        return (a.seasonName || '').localeCompare(b.seasonName || '');
    });
}

// Helper: find a show document. Fast indexed lookup by showName_lower with self-healing fallback.
async function findShowDoc(quizzesRef, normalizedName) {
    // 1. Direct document lookup by ID if keyed by slug
    try {
        const directDoc = await quizzesRef.doc(normalizedName).get();
        if (directDoc.exists) {
            return { id: directDoc.id, ref: directDoc.ref, data: directDoc.data() };
        }
    } catch {
        // Continue to query if doc ID has special characters
    }

    // 2. Fast indexed query by showName_lower
    const indexedQuery = await quizzesRef.where('showName_lower', '==', normalizedName).limit(1).get();
    if (!indexedQuery.empty) {
        const doc = indexedQuery.docs[0];
        return { id: doc.id, ref: doc.ref, data: doc.data() };
    }

    // 3. Fallback scan for legacy documents that don't have showName_lower yet
    const snapshot = await quizzesRef.get();
    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data && data.showName && data.showName.trim().toLowerCase() === normalizedName) {
            // Self-heal: backfill showName_lower asynchronously so all future lookups are indexed
            doc.ref.update({ showName_lower: normalizedName }).catch(() => {});
            return { id: doc.id, ref: doc.ref, data, snapshot };
        }
    }
    return { id: null, ref: null, data: null, snapshot };
}

// Fetches a list of shows including their seasons (Cached with HTTP Cache-Control).
app.get('/shows', async (req, res) => {
    try {
        if (cachedShowsList && Date.now() < cachedShowsListExpiry) {
            res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
            return res.status(200).json(cachedShowsList);
        }

        const snapshot = await db.collection('quizzes').get();
        if (snapshot.empty) {
            cachedShowsList = [];
            cachedShowsListExpiry = Date.now() + 30000;
            return res.status(200).json([]);
        }

        const showsList = snapshot.docs.map(doc => {
            const data = doc.data();
            const sortedSeasons = sortSeasons(data.seasons || []);
            return {
                id: doc.id,
                name: data.showName,
                posterUrl: data.posterUrl,
                seasons: sortedSeasons.map(s => ({ seasonName: s.seasonName, questionCount: (s.questions || []).length }))
            };
        });

        cachedShowsList = showsList;
        cachedShowsListExpiry = Date.now() + 60000; // 60s memory TTL

        res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
        res.status(200).json(showsList);
    } catch (error) {
        console.error('Error fetching shows:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Fetches quiz questions for a specific show and season (Cached).
app.get('/quizzes/:showName/:seasonName', async (req, res) => {
    try {
        const normalizedShow = decodeURIComponent(req.params.showName).trim().toLowerCase();
        const normalizedSeason = decodeURIComponent(req.params.seasonName).trim().toLowerCase();
        const cacheKey = `${normalizedShow}::${normalizedSeason}`;

        const cached = cachedQuizMap.get(cacheKey);
        if (cached && Date.now() < cached.expiry) {
            res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
            return res.status(200).json(cached.data);
        }

        const quizzesRef = db.collection('quizzes');
        const { data: foundDoc } = await findShowDoc(quizzesRef, normalizedShow);

        if (!foundDoc) {
            return res.status(404).json({ message: 'No quiz found for this show.' });
        }

        // "All Questions" — aggregate across all seasons of the matched show.
        if (normalizedSeason === 'all questions') {
            let allQuestions = [];
            for (const season of (foundDoc.seasons || [])) {
                allQuestions = allQuestions.concat(season.questions || []);
            }
            cachedQuizMap.set(cacheKey, { data: allQuestions, expiry: Date.now() + 300000 }); // 5 min TTL
            res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
            return res.status(200).json(allQuestions);
        }

        const season = (foundDoc.seasons || []).find(
            s => (s.seasonName || '').trim().toLowerCase() === normalizedSeason
        );
        if (!season) {
            return res.status(404).json({ message: `No quiz found for season: ${req.params.seasonName}` });
        }

        const questions = season.questions || [];
        cachedQuizMap.set(cacheKey, { data: questions, expiry: Date.now() + 300000 }); // 5 min TTL
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        res.status(200).json(questions);
    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Handles user signup (Indexed doc ID lookup & point write).
app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }
        const usersRef = db.collection('users');
        const normalizedUsername = username.trim().toLowerCase();
        const userDocRef = usersRef.doc(normalizedUsername);

        // Fast document read by ID first
        const docSnap = await userDocRef.get();
        if (docSnap.exists) {
            return res.status(400).json({ message: 'Username already exists.' });
        }

        // Fallback check legacy documents with auto-generated IDs
        const existing = await usersRef.where('username', '==', username).limit(1).get();
        if (!existing.empty) {
            return res.status(400).json({ message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await userDocRef.set({ username, username_lower: normalizedUsername, password: hashedPassword, isAdmin: false });
        res.status(201).json({ message: 'User created successfully!' });
    } catch (error) {
        console.error('Error in signup:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Handles regular user login (Fast doc lookup).
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }
        const usersRef = db.collection('users');
        const normalizedUsername = username.trim().toLowerCase();

        let userDoc = await usersRef.doc(normalizedUsername).get();
        let userData;

        if (userDoc.exists) {
            userData = userDoc.data();
        } else {
            // Legacy fallback
            const snapshot = await usersRef.where('username', '==', username).limit(1).get();
            if (snapshot.empty) {
                return res.status(401).json({ message: 'Invalid username or password.' });
            }
            userData = snapshot.docs[0].data();
        }

        if (!await bcrypt.compare(password, userData.password)) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        res.status(200).json({ message: 'Login successful!', username: userData.username, isAdmin: userData.isAdmin || false });
    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Handles admin login (Fast doc lookup).
app.post('/admin-login', async (req, res) => {
    try {
        const { username, password, adminKey } = req.body;
        if (!username || !password || !adminKey) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        if (adminKey !== ADMIN_KEY) {
            return res.status(401).json({ message: 'Invalid admin key.' });
        }
        const usersRef = db.collection('users');
        const normalizedUsername = username.trim().toLowerCase();

        let userDoc = await usersRef.doc(normalizedUsername).get();
        let userData;
        let targetRef;

        if (userDoc.exists) {
            userData = userDoc.data();
            targetRef = userDoc.ref;
        } else {
            const snapshot = await usersRef.where('username', '==', username).limit(1).get();
            if (snapshot.empty) {
                return res.status(401).json({ message: 'Invalid username or password.' });
            }
            userData = snapshot.docs[0].data();
            targetRef = snapshot.docs[0].ref;
        }

        if (!await bcrypt.compare(password, userData.password)) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        await targetRef.update({ isAdmin: true });
        res.status(200).json({ message: 'Admin login successful!', username: userData.username, isAdmin: true });
    } catch (error) {
        console.error('Error in admin login:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Adds a new question to a show/season, creating the show or season if needed.
app.post('/add-question', async (req, res) => {
    try {
        const { showName, seasonName, posterUrl, question, options, answer } = req.body;
        if (!showName || !seasonName || !question || !options || !answer) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        const quizzesRef = db.collection('quizzes');
        const normalizedShowName = showName.trim().toLowerCase();

        const { id: existingId, ref: existingRef } = await findShowDoc(quizzesRef, normalizedShowName);

        if (!existingId) {
            // New show
            if (!posterUrl) {
                return res.status(400).json({ message: 'Poster URL is required to create a new show.' });
            }
            await quizzesRef.add({
                showName,
                showName_lower: normalizedShowName,
                posterUrl,
                seasons: [{ seasonName, questions: [{ question, options, answer }] }]
            });
            invalidateShowsCache();
            return res.status(201).json({ message: `Show '${showName}' and its first question added successfully!` });
        }

        // Use a transaction to avoid race conditions when updating nested arrays.
        try {
            await db.runTransaction(async (t) => {
                const docSnap = await t.get(existingRef);
                const seasons = (docSnap.data() || {}).seasons || [];
                const seasonIndex = seasons.findIndex(s => (s.seasonName || '').trim() === seasonName.trim());

                if (seasonIndex > -1) {
                    const questions = seasons[seasonIndex].questions || [];
                    if (questions.some(q => q.question === question)) {
                        const err = new Error('DUPLICATE_QUESTION');
                        err.code = 'DUPLICATE_QUESTION';
                        throw err;
                    }
                    questions.push({ question, options, answer });
                    seasons[seasonIndex].questions = questions;
                } else {
                    seasons.push({ seasonName, questions: [{ question, options, answer }] });
                }
                t.update(existingRef, { seasons, showName_lower: normalizedShowName });
            });
            invalidateShowsCache();
        } catch (txErr) {
            if (txErr && txErr.code === 'DUPLICATE_QUESTION') {
                return res.status(409).json({ message: 'This question already exists for this show and season.' });
            }
            console.error('Transaction error while adding question:', txErr);
            return res.status(500).json({ message: 'Internal server error during update.' });
        }

        return res.status(201).json({ message: `Question added successfully for ${showName} - ${seasonName}!` });
    } catch (error) {
        console.error('Error adding new question:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Bulk-upload an array of questions in chunked Firestore batches.
app.post('/bulk-upload', async (req, res) => {
    try {
        const { questions } = req.body;
        if (!Array.isArray(questions)) {
            return res.status(400).json({ message: 'Expected an array of questions.' });
        }

        const quizzesRef = db.collection('quizzes');

        // Preload existing shows for case-insensitive matching.
        const existingSnapshot = await quizzesRef.get();
        const existingShowsMap = {};
        for (const doc of existingSnapshot.docs) {
            const data = doc.data();
            if (data && data.showName) {
                existingShowsMap[data.showName.trim().toLowerCase()] = { docRef: doc.ref, data };
            }
        }

        const showsToUpdate = {};
        let duplicateCount = 0;

        for (const quizData of questions) {
            const { showName, posterUrl, seasonName, question, options, answer } = quizData;
            if (!showName || !seasonName || !question || !options || !answer) {
                console.warn(`Skipping malformed quiz data: ${JSON.stringify(quizData)}`);
                continue;
            }

            const normalized = showName.trim().toLowerCase();

            if (!showsToUpdate[normalized]) {
                const existing = existingShowsMap[normalized];
                showsToUpdate[normalized] = existing
                    ? { docRef: existing.docRef, data: { ...existing.data, seasons: (existing.data.seasons || []).map(s => ({ ...s, questions: [...(s.questions || [])] })) }, isNew: false }
                    : { docRef: quizzesRef.doc(), data: { showName, showName_lower: normalized, posterUrl, seasons: [] }, isNew: true };
            }

            const existingData = showsToUpdate[normalized].data;
            const seasons = existingData.seasons || [];
            const seasonIndex = seasons.findIndex(s => s.seasonName === seasonName);

            if (seasonIndex > -1) {
                const existingQuestions = seasons[seasonIndex].questions || [];
                if (existingQuestions.some(q => q.question === question)) {
                    duplicateCount++;
                } else {
                    existingQuestions.push({ question, options, answer });
                    seasons[seasonIndex].questions = existingQuestions;
                }
            } else {
                seasons.push({ seasonName, questions: [{ question, options, answer }] });
            }
            existingData.seasons = seasons;
        }

        // Commit in chunks of 400 operations to stay well below Firestore 500-op batch limit
        const entries = Object.values(showsToUpdate);
        const BATCH_SIZE = 400;
        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = entries.slice(i, i + BATCH_SIZE);
            for (const { docRef, data, isNew } of chunk) {
                if (isNew) {
                    batch.set(docRef, data);
                } else {
                    batch.update(docRef, { seasons: data.seasons, showName_lower: data.showName ? data.showName.trim().toLowerCase() : undefined });
                }
            }
            await batch.commit();
        }

        invalidateShowsCache();

        const processedCount = questions.length - duplicateCount;
        res.status(201).json({
            message: `Bulk upload successful! Processed ${processedCount} items (${duplicateCount} duplicates skipped).`
        });
    } catch (error) {
        console.error('Error during bulk upload:', error);
        res.status(500).json({ message: 'Internal server error during bulk upload.' });
    }
});

// Submits a user's score to the leaderboard.
app.post('/submit-score', async (req, res) => {
    try {
        const { username, showName, seasonName, score } = req.body;
        if (!username || !showName || !seasonName || score === undefined) {
            return res.status(400).json({ message: 'Username, show name, season name, and score are required.' });
        }
        await db.collection('scores').add({
            username,
            showName,
            seasonName,
            score,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        invalidateScoreCaches(showName);
        res.status(201).json({ message: 'Score submitted successfully!' });
    } catch (error) {
        console.error('Error submitting score:', error);
        res.status(500).json({ message: 'Failed to submit score.' });
    }
});

// Fetches the top 10 scores for a given show (Cached).
app.get('/leaderboard/:showName', async (req, res) => {
    try {
        const showName = decodeURIComponent(req.params.showName);
        const cacheKey = showName.trim().toLowerCase();

        const cached = cachedLeaderboards.get(cacheKey);
        if (cached && Date.now() < cached.expiry) {
            return res.status(200).json(cached.data);
        }

        const snapshot = await db.collection('scores')
            .where('showName', '==', showName)
            .orderBy('score', 'desc')
            .limit(10)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({ message: 'No scores found for this show yet.' });
        }

        const results = snapshot.docs.map(doc => doc.data());
        cachedLeaderboards.set(cacheKey, { data: results, expiry: Date.now() + 30000 }); // 30s TTL
        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: 'Failed to fetch leaderboard.' });
    }
});

// Fetches the global leaderboard with 30s TTL memory caching.
app.get('/global-leaderboard', async (req, res) => {
    try {
        if (cachedGlobalLeaderboard && Date.now() < cachedGlobalLeaderboardExpiry) {
            return res.status(200).json(cachedGlobalLeaderboard);
        }

        const snapshot = await db.collection('scores').get();
        if (snapshot.empty) return res.status(200).json([]);

        // Aggregate best score per (username, showName, seasonName) key.
        const bestPerQuiz = {};
        for (const doc of snapshot.docs) {
            const { username, showName, seasonName, score } = doc.data();
            const key = `${username}\0${showName}\0${seasonName}`;
            if (!bestPerQuiz[key] || score > bestPerQuiz[key]) {
                bestPerQuiz[key] = { username, score };
            }
        }

        // Sum best scores per user.
        const globalScores = {};
        for (const { username, score } of Object.values(bestPerQuiz)) {
            if (globalScores[username]) {
                globalScores[username] += score;
            } else {
                globalScores[username] = score;
            }
        }

        const leaderboard = Object.entries(globalScores)
            .map(([username, globalScore]) => ({ username, globalScore }))
            .sort((a, b) => b.globalScore - a.globalScore);

        cachedGlobalLeaderboard = leaderboard;
        cachedGlobalLeaderboardExpiry = Date.now() + 30000; // 30s memory TTL

        res.status(200).json(leaderboard);
    } catch (error) {
        console.error('Error fetching global leaderboard:', error);
        res.status(500).json({ message: 'Failed to fetch global leaderboard.' });
    }
});

// Serve static files with 1-day caching headers
const frontendBuildSibling = path.join(__dirname, '..', 'leetflix-frontend', 'build');
const backendBuild = path.join(__dirname, 'build');
const staticPath = fs.existsSync(frontendBuildSibling) ? frontendBuildSibling : backendBuild;
app.use(express.static(staticPath, {
    maxAge: '1d',
    etag: true
}));

// Export express app for serverless function platforms (Vercel)
module.exports = app;

// Only listen on port if executed directly
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}
