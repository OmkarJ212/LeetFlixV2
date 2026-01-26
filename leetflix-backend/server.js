const express = require('express');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const cors = require('cors');
const bcrypt = require('bcryptjs');

let serviceAccount;
try {
    serviceAccount = require('./serviceAccountKey.json');
} catch (error) {
    console.error("--- FATAL ERROR: Could not load or parse serviceAccountKey.json ---\nDetailed Error:", error.message);
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_KEY = "your-secret-admin-key"; // CHANGE THIS to your desired key

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

// Fetches a list of shows, including their seasons
app.get('/shows', async (req, res) => {
    try {
        const quizzesRef = db.collection('quizzes');
        const snapshot = await quizzesRef.get();
        if (snapshot.empty) {
            // Return an empty array (200) so clients can handle no-data gracefully
            return res.status(200).json([]);
        }
        const showsList = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.showName,
                posterUrl: data.posterUrl,
                // Include seasonName and the number of questions so clients can show counts
                seasons: data.seasons ? data.seasons.map(s => ({ seasonName: s.seasonName, questionCount: (s.questions || []).length })) : []
            };
        });
        res.status(200).json(showsList);
    } catch (error) {
        console.error('Error fetching shows:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// NEW API ENDPOINT: Fetches quiz questions for a specific show and season
app.get('/quizzes/:showName/:seasonName', async (req, res) => {
    try {
        const { showName, seasonName } = req.params;
        const decodedShowName = decodeURIComponent(showName);
        const decodedSeasonName = decodeURIComponent(seasonName);
        const quizzesRef = db.collection('quizzes');
        const snapshot = await quizzesRef.get();

        if (snapshot.empty) {
            return res.status(404).json({ message: 'No quizzes found in the database.' });
        }

        // Do a case-insensitive match and trim whitespace to be more forgiving when matching show names
        const normalizedTargetShow = decodedShowName.trim().toLowerCase();
        const normalizedTargetSeason = decodedSeasonName.trim().toLowerCase();

        // Special case for "All Questions" season to combine all questions from all seasons of the show
        if (normalizedTargetSeason === "all questions") {
            let allQuestions = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data && data.showName && data.showName.trim().toLowerCase() === normalizedTargetShow) {
                    if (data.seasons) {
                        data.seasons.forEach(season => {
                            if (season.questions) {
                                allQuestions = allQuestions.concat(season.questions);
                            }
                        });
                    }
                }
            });
            res.status(200).json(allQuestions);
            return;
        }

        let foundDoc = null;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data && data.showName && data.showName.trim().toLowerCase() === normalizedTargetShow) {
                foundDoc = data;
            }
        });

        if (!foundDoc) {
            return res.status(404).json({ message: 'No quiz found for this show.' });
        }

        const season = (foundDoc.seasons || []).find(s => (s.seasonName || '').trim().toLowerCase() === normalizedTargetSeason);

        if (!season) {
            return res.status(404).json({ message: `No quiz found for season: ${decodedSeasonName}` });
        }

        res.status(200).json(season.questions || []);

    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Handles user signup
app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('username', '==', username).get();
        if (!snapshot.empty) {
            return res.status(400).json({ message: 'Username already exists.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { username, password: hashedPassword, isAdmin: false };
        await usersRef.add(newUser);
        res.status(201).json({ message: 'User created successfully!' });
    } catch (error) {
        console.error('Error in signup:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Handles regular user login
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('username', '==', username).get();
        if (snapshot.empty) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        const userData = snapshot.docs[0].data();
        const isPasswordCorrect = await bcrypt.compare(password, userData.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        res.status(200).json({ message: 'Login successful!', username: userData.username, isAdmin: userData.isAdmin || false });
    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// NEW API ENDPOINT: Handles admin login
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
        const userData = snapshot.docs[0].data();
        const isPasswordCorrect = await bcrypt.compare(password, userData.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        
        await usersRef.doc(snapshot.docs[0].id).update({ isAdmin: true });
        
        res.status(200).json({ message: 'Admin login successful!', username: userData.username, isAdmin: true });
    } catch (error) {
        console.error('Error in admin login:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API ENDPOINT: Adds a new show and its first question, or just a new question to an existing show.
app.post('/add-question', async (req, res) => {
    try {
        const { showName, seasonName, posterUrl, question, options, answer } = req.body;

        if (!showName || !seasonName || !question || !options || !answer) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        const quizzesRef = db.collection('quizzes');

        // Normalize input for case-insensitive matching
        const normalizedShowName = showName.trim().toLowerCase();

        // Fetch all quizzes and look for a case-insensitive match to avoid duplicate show documents
        const allSnapshot = await quizzesRef.get();
        let existingDoc = null;
        allSnapshot.forEach(doc => {
            const data = doc.data();
            if (data && data.showName && data.showName.trim().toLowerCase() === normalizedShowName) {
                existingDoc = { id: doc.id, ref: doc.ref, data };
            }
        });

        if (!existingDoc) {
            // Show does not exist, create it
            if (!posterUrl) {
                return res.status(400).json({ message: 'Poster URL is required to create a new show.' });
            }
            const newShowData = {
                showName,
                posterUrl,
                seasons: [{
                    seasonName,
                    questions: [{ question, options, answer }]
                }]
            };
            await quizzesRef.add(newShowData);
            return res.status(201).json({ message: `Show '${showName}' and its first question added successfully!` });
        }

        // Use a transaction to avoid race conditions when updating nested arrays
        try {
            await db.runTransaction(async (t) => {
                const docSnap = await t.get(existingDoc.ref);
                const quizData = docSnap.data() || {};
                const seasons = quizData.seasons || [];

                const seasonIndex = seasons.findIndex(s => (s.seasonName || '').trim() === seasonName.trim());

                if (seasonIndex > -1) {
                    const questions = seasons[seasonIndex].questions || [];
                    if (questions.some(q => q.question === question)) {
                        // Throw to abort transaction and indicate duplicate
                        const err = new Error('DUPLICATE_QUESTION');
                        err.code = 'DUPLICATE_QUESTION';
                        throw err;
                    }
                    questions.push({ question, options, answer });
                    seasons[seasonIndex].questions = questions;
                } else {
                    seasons.push({ seasonName, questions: [{ question, options, answer }] });
                }

                t.update(existingDoc.ref, { seasons });
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

// NEW API ENDPOINT FOR BULK UPLOAD
app.post('/bulk-upload', async (req, res) => {
    try {
        const { questions } = req.body;
        if (!Array.isArray(questions)) {
            return res.status(400).json({ message: 'Expected an array of questions.' });
        }
        
        const quizzesRef = db.collection('quizzes');
        const batch = db.batch();

        // Preload existing shows to perform case-insensitive matching and avoid duplicate documents
        const existingSnapshot = await quizzesRef.get();
        const existingShowsMap = {};
        existingSnapshot.forEach(doc => {
            const data = doc.data();
            if (data && data.showName) {
                existingShowsMap[data.showName.trim().toLowerCase()] = { docRef: doc.ref, data };
            }
        });

        const showsToUpdate = {};

        for (const quizData of questions) {
            const { showName, posterUrl, seasonName, question, options, answer } = quizData;

            if (!showName || !seasonName || !question || !options || !answer) {
                console.warn(`Skipping malformed quiz data: ${JSON.stringify(quizData)}`);
                continue;
            }

            const normalized = showName.trim().toLowerCase();

            if (!showsToUpdate[normalized]) {
                const existing = existingShowsMap[normalized];
                if (!existing) {
                    // New show
                    showsToUpdate[normalized] = {
                        docRef: quizzesRef.doc(),
                        data: {
                            showName,
                            posterUrl,
                            seasons: [{ seasonName, questions: [{ question, options, answer }] }]
                        },
                        isNew: true
                    };
                } else {
                    // Existing show
                    showsToUpdate[normalized] = {
                        docRef: existing.docRef,
                        data: JSON.parse(JSON.stringify(existing.data)), // shallow clone
                        isNew: false
                    };
                }
            } else {
                // Already accumulating updates for this show
                const existingData = showsToUpdate[normalized].data;
                let seasons = existingData.seasons || [];
                const seasonIndex = seasons.findIndex(s => s.seasonName === seasonName);

                if (seasonIndex > -1) {
                    let existingQuestions = seasons[seasonIndex].questions || [];
                    existingQuestions.push({ question, options, answer });
                    seasons[seasonIndex].questions = existingQuestions;
                } else {
                    seasons.push({ seasonName, questions: [{ question, options, answer }] });
                }
                existingData.seasons = seasons;
            }
        }

        // Commit changes in a single batch
        for (const key in showsToUpdate) {
            const { docRef, data, isNew } = showsToUpdate[key];
            if (isNew) {
                batch.set(docRef, data);
            } else {
                batch.update(docRef, { seasons: data.seasons });
            }
        }

        await batch.commit();
        res.status(201).json({ message: `Bulk upload successful! Processed ${questions.length} items.` });
        
    } catch (error) {
        console.error('Error during bulk upload:', error);
        res.status(500).json({ message: 'Internal server error during bulk upload.' });
    }
});

// NEW API ENDPOINT: Submits a user's score to the leaderboard
app.post('/submit-score', async (req, res) => {
    try {
        const { username, showName, seasonName, score } = req.body;
        if (!username || !showName || !seasonName || score === undefined) {
            return res.status(400).json({ message: 'Username, show name, season name, and score are required.' });
        }
        const scoresRef = db.collection('scores');
        await scoresRef.add({
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

// NEW API ENDPOINT: Fetches the top 10 scores for a given show
app.get('/leaderboard/:showName', async (req, res) => {
    try {
        const { showName } = req.params;
        const scoresRef = db.collection('scores');
        const snapshot = await scoresRef
            .where('showName', '==', showName)
            .orderBy('score', 'desc')
            .limit(10)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({ message: 'No scores found for this show yet.' });
        }

        const leaderboard = snapshot.docs.map(doc => doc.data());
        res.status(200).json(leaderboard);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: 'Failed to fetch leaderboard.' });
    }
});


// NEW API ENDPOINT: Fetches the global leaderboard with best scores only
app.get('/global-leaderboard', async (req, res) => {
    try {
        const scoresRef = db.collection('scores');
        const snapshot = await scoresRef.get();

        if (snapshot.empty) {
            return res.status(200).json([]);
        }

        const bestScoresPerQuiz = {};

        snapshot.forEach(doc => {
            const { username, showName, seasonName, score } = doc.data();
            const quizKey = `${username}-${showName}-${seasonName}`;
            
            if (!bestScoresPerQuiz[quizKey] || score > bestScoresPerQuiz[quizKey].score) {
                bestScoresPerQuiz[quizKey] = {
                    username,
                    score,
                    showName,
                    seasonName
                };
            }
        });

        const globalScores = {};
        Object.values(bestScoresPerQuiz).forEach(entry => {
            if (globalScores[entry.username]) {
                globalScores[entry.username].globalScore += entry.score;
            } else {
                globalScores[entry.username] = {
                    username: entry.username,
                    globalScore: entry.score
                };
            }
        });

        // Convert the object to an array and sort by global score in descending order
        const leaderboard = Object.values(globalScores).sort((a, b) => b.globalScore - a.globalScore);

        res.status(200).json(leaderboard);
    } catch (error) {
        console.error('Error fetching global leaderboard:', error);
        res.status(500).json({ message: 'Failed to fetch global leaderboard.' });
    }
});

// Serve static files from the determined staticPath (after API routes so APIs take precedence)
app.use(express.static(staticPath));

// For any other route (not handled above), serve the frontend's index.html so the SPA routing works
// Catch-all: serve React's index.html for non-API GET requests so SPA routing works.
app.use((req, res, next) => {
    // Only handle GET requests that accept HTML
    if (req.method !== 'GET' || !req.accepts || !req.accepts('html')) {
        return next();
    }

    // Treat these paths as API routes; let the earlier route handlers handle them or return 404
    const apiPrefixes = ['/signup', '/login', '/admin-login', '/shows', '/quizzes', '/add-question', '/bulk-upload', '/submit-score', '/leaderboard', '/global-leaderboard'];
    for (const prefix of apiPrefixes) {
        if (req.path.startsWith(prefix)) return next();
    }

    const indexPath = path.join(staticPath, 'index.html');
    return res.sendFile(indexPath, err => {
        if (err) next(err);
    });
});

// Bind to all interfaces so other devices on the LAN can connect
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    // Try to discover LAN IPv4 addresses to print helpful URLs
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const addresses = [];
    Object.keys(interfaces).forEach(ifname => {
        interfaces[ifname].forEach(iface => {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
            }
        });
    });

    console.log(`Server is running on http://localhost:${PORT} (bound to ${HOST})`);
    if (addresses.length) {
        console.log('Accessible on your LAN at:');
        addresses.forEach(a => console.log(`  http://${a}:${PORT}`));
    } else {
        console.log('No external network interfaces detected. If you expect other devices to connect, ensure you are on a LAN and disable any restrictive firewalls.');
    }
});

// Write PID file so external tools can stop this specific server process
try {
    const pidPath = path.join(__dirname, 'backend.pid');
    fs.writeFileSync(pidPath, String(process.pid), { encoding: 'utf8' });
    const cleanupPidFile = () => {
        try { if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath); } catch (e) { /* ignore */ }
    };
    process.on('exit', cleanupPidFile);
    process.on('SIGINT', () => { cleanupPidFile(); process.exit(0); });
    process.on('SIGTERM', () => { cleanupPidFile(); process.exit(0); });
} catch (err) {
    console.warn('Could not write PID file for backend process:', err && err.message);
}