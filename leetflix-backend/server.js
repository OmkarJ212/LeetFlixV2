const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const admin = require('firebase-admin');
const cors = require('cors');
const bcrypt = require('bcryptjs');

let serviceAccount;
try {
    serviceAccount = require('./serviceAccountKey.json');
} catch (error) {
    console.error('--- FATAL ERROR: Could not load or parse serviceAccountKey.json ---\nDetailed Error:', error.message);
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 3001;

const ADMIN_KEY = 'your-secret-admin-key'; // CHANGE THIS to your desired key

app.use(cors());
app.use(express.json());

// Determine where the frontend build is located. Prefer sibling frontend/build when present so
// the backend serves the freshly built frontend during development; fall back to backend/build.
const frontendBuildSibling = path.join(__dirname, '..', 'leetflix-frontend', 'build');
const backendBuild = path.join(__dirname, 'build');
const staticPath = fs.existsSync(frontendBuildSibling) ? frontendBuildSibling : backendBuild;
if (!fs.existsSync(path.join(staticPath, 'index.html'))) {
    console.warn('Warning: index.html not found in staticPath:', staticPath);
}

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

// Helper: find a show document by case-insensitive name. Returns { id, ref, data } or null.
async function findShowDoc(quizzesRef, normalizedName) {
    const snapshot = await quizzesRef.get();
    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data && data.showName && data.showName.trim().toLowerCase() === normalizedName) {
            return { id: doc.id, ref: doc.ref, data, snapshot };
        }
    }
    return { id: null, ref: null, data: null, snapshot };
}

// Fetches a list of shows including their seasons.
app.get('/shows', async (req, res) => {
    try {
        const snapshot = await db.collection('quizzes').get();
        if (snapshot.empty) return res.status(200).json([]);

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
        res.status(200).json(showsList);
    } catch (error) {
        console.error('Error fetching shows:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Fetches quiz questions for a specific show and season.
app.get('/quizzes/:showName/:seasonName', async (req, res) => {
    try {
        const normalizedShow = decodeURIComponent(req.params.showName).trim().toLowerCase();
        const normalizedSeason = decodeURIComponent(req.params.seasonName).trim().toLowerCase();
        const quizzesRef = db.collection('quizzes');

        // "All Questions" — aggregate across all seasons of the matched show.
        if (normalizedSeason === 'all questions') {
            const snapshot = await quizzesRef.get();
            let allQuestions = [];
            for (const doc of snapshot.docs) {
                const data = doc.data();
                if (data && data.showName && data.showName.trim().toLowerCase() === normalizedShow) {
                    for (const season of (data.seasons || [])) {
                        allQuestions = allQuestions.concat(season.questions || []);
                    }
                    break; // show names are unique
                }
            }
            return res.status(200).json(allQuestions);
        }

        const { data: foundDoc } = await findShowDoc(quizzesRef, normalizedShow);
        if (!foundDoc) {
            return res.status(404).json({ message: 'No quiz found for this show.' });
        }

        const season = (foundDoc.seasons || []).find(
            s => (s.seasonName || '').trim().toLowerCase() === normalizedSeason
        );
        if (!season) {
            return res.status(404).json({ message: `No quiz found for season: ${req.params.seasonName}` });
        }

        res.status(200).json(season.questions || []);
    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Handles user signup.
app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }
        const usersRef = db.collection('users');
        const existing = await usersRef.where('username', '==', username).get();
        if (!existing.empty) {
            return res.status(400).json({ message: 'Username already exists.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await usersRef.add({ username, password: hashedPassword, isAdmin: false });
        res.status(201).json({ message: 'User created successfully!' });
    } catch (error) {
        console.error('Error in signup:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Handles regular user login.
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }
        const snapshot = await db.collection('users').where('username', '==', username).get();
        if (snapshot.empty) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        const userData = snapshot.docs[0].data();
        if (!await bcrypt.compare(password, userData.password)) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        res.status(200).json({ message: 'Login successful!', username: userData.username, isAdmin: userData.isAdmin || false });
    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Handles admin login.
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
        const snapshot = await usersRef.where('username', '==', username).get();
        if (snapshot.empty) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        if (!await bcrypt.compare(password, userData.password)) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        await usersRef.doc(userDoc.id).update({ isAdmin: true });
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
                posterUrl,
                seasons: [{ seasonName, questions: [{ question, options, answer }] }]
            });
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
                t.update(existingRef, { seasons });
            });
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

// Bulk-upload an array of questions in a single Firestore batch.
app.post('/bulk-upload', async (req, res) => {
    try {
        const { questions } = req.body;
        if (!Array.isArray(questions)) {
            return res.status(400).json({ message: 'Expected an array of questions.' });
        }

        const quizzesRef = db.collection('quizzes');
        const batch = db.batch();

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
                    ? { docRef: existing.docRef, data: JSON.parse(JSON.stringify(existing.data)), isNew: false }
                    : { docRef: quizzesRef.doc(), data: { showName, posterUrl, seasons: [] }, isNew: true };
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

        for (const { docRef, data, isNew } of Object.values(showsToUpdate)) {
            if (isNew) {
                batch.set(docRef, data);
            } else {
                batch.update(docRef, { seasons: data.seasons });
            }
        }

        await batch.commit();
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
        res.status(201).json({ message: 'Score submitted successfully!' });
    } catch (error) {
        console.error('Error submitting score:', error);
        res.status(500).json({ message: 'Failed to submit score.' });
    }
});

// Fetches the top 10 scores for a given show.
app.get('/leaderboard/:showName', async (req, res) => {
    try {
        const showName = decodeURIComponent(req.params.showName);
        const snapshot = await db.collection('scores')
            .where('showName', '==', showName)
            .orderBy('score', 'desc')
            .limit(10)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({ message: 'No scores found for this show yet.' });
        }
        res.status(200).json(snapshot.docs.map(doc => doc.data()));
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: 'Failed to fetch leaderboard.' });
    }
});

// Fetches the global leaderboard: best score per user per quiz, summed across all quizzes.
app.get('/global-leaderboard', async (req, res) => {
    try {
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

        res.status(200).json(leaderboard);
    } catch (error) {
        console.error('Error fetching global leaderboard:', error);
        res.status(500).json({ message: 'Failed to fetch global leaderboard.' });
    }
});

// Serve static files (after API routes so APIs take precedence).
app.use(express.static(staticPath));

// Catch-all: serve React's index.html for non-API GET requests so SPA routing works.
const API_PREFIXES = ['/signup', '/login', '/admin-login', '/shows', '/quizzes', '/add-question', '/bulk-upload', '/submit-score', '/leaderboard', '/global-leaderboard'];
app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (API_PREFIXES.some(p => req.path.startsWith(p))) return next();
    res.sendFile(path.join(staticPath, 'index.html'), err => { if (err) next(err); });
});

app.listen(PORT, '0.0.0.0', () => {
    const addresses = [];
    for (const ifaces of Object.values(os.networkInterfaces())) {
        for (const iface of ifaces) {
            if (iface.family === 'IPv4' && !iface.internal) addresses.push(iface.address);
        }
    }
    console.log(`Server running on http://localhost:${PORT}`);
    if (addresses.length) {
        console.log('LAN:', addresses.map(a => `http://${a}:${PORT}`).join('  '));
    }
});

// Write PID file so external tools can stop this specific server process.
try {
    const pidPath = path.join(__dirname, 'backend.pid');
    fs.writeFileSync(pidPath, String(process.pid), { encoding: 'utf8' });
    const cleanup = () => { try { if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath); } catch (_) {} };
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });
} catch (err) {
    console.warn('Could not write PID file:', err && err.message);
}