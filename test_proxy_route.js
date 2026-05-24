fetch('http://127.0.0.1:3000/api/gemini-proxy', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    model: 'gemini-1.5-pro',
    contents: [{role: 'user', parts: [{text: 'Hello'}]}]
  })
}).then(r => r.text()).then(console.log).catch(console.error);
