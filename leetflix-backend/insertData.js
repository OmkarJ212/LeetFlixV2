const admin = require('firebase-admin');
const showsAndQuizzes = require('./data.js');

let serviceAccount;
try {
    serviceAccount = require('./serviceAccountKey.json');
} catch (error) {
    console.error("--- FATAL ERROR: Could not load or parse serviceAccountKey.json ---");
    console.error("Please ensure the file exists and is correctly formatted.");
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// This function deletes all documents in a collection in batches of 500
async function deleteCollection(collectionPath) {
  const collectionRef = db.collection(collectionPath);
  const batchSize = 500;
  
  console.log(`Clearing collection: ${collectionPath}...`);

  let query = collectionRef.limit(batchSize);
  
  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();

  if (snapshot.size === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

// Main function to add quizzes to Firestore in high-performance batch writes
async function addQuizzes() {
  // First, empty the existing quizzes collection to prevent duplicates
  await deleteCollection('quizzes');
  
  console.log("Starting data insertion...");
  const quizzesRef = db.collection('quizzes');
  const batch = db.batch();
  
  // Add new data with showName_lower in a single atomic batch
  for (const quizData of showsAndQuizzes) {
    const docRef = quizzesRef.doc();
    const preparedData = {
      ...quizData,
      showName_lower: (quizData.showName || '').trim().toLowerCase()
    };
    batch.set(docRef, preparedData);
  }

  await batch.commit();
  console.log(`Successfully batch-inserted ${showsAndQuizzes.length} shows!`);
  console.log("Data insertion complete!");
}

addQuizzes();
