(async () => {
  const base = 'http://localhost:3000';
  const testShow = `E2E_Test_Show_${Date.now()}`;
  const testSeason = 'S1';
  const payload = {
    showName: testShow,
    seasonName: testSeason,
    posterUrl: 'https://placehold.co/250x370/222/fff?text=E2E',
    question: 'E2E test question?',
    options: ['A','B','C'],
    answer: 'A'
  };

  try {
    console.log('POST /add-question -> creating test show/question');
    const postRes = await fetch(`${base}/add-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const postJson = await postRes.json();
    console.log('POST status', postRes.status, postJson);

    // wait briefly for Firestore to commit
    await new Promise(r=>setTimeout(r,1000));

    console.log('\nGET /shows -> looking for our test show');
    const showsRes = await fetch(`${base}/shows`);
    const showsJson = await showsRes.json();
    console.log('GET /shows status', showsRes.status);
    const found = showsJson.find(s => s.name === testShow);
    if (found) console.log('Found show in /shows:', found);
    else console.log('Test show NOT found in /shows');

    console.log('\nGET /quizzes/:show/:season -> fetching questions');
    const encShow = encodeURIComponent(testShow);
    const encSeason = encodeURIComponent(testSeason);
    const quizRes = await fetch(`${base}/quizzes/${encShow}/${encSeason}`);
    console.log('GET /quizzes status', quizRes.status);
    const quizJson = await quizRes.json();
    console.log('Quiz data:', quizJson);

  } catch (err) {
    console.error('E2E test failed:', err);
  }
})();
