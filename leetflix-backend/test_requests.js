(async () => {
  const urls = ['http://localhost:3000/', 'http://localhost:3000/shows'];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log('URL:', url);
      console.log('Status:', res.status);
      const out = text.length > 500 ? text.slice(0, 500) + '\n...[truncated]' : text;
      console.log('Body preview:\n', out);
    } catch (err) {
      console.error('Error fetching', url, err.message || err);
    }
    console.log('\n---\n');
  }
})();
