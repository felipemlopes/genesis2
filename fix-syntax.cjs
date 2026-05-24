const fs = require('fs');
let appContent = fs.readFileSync('./App.tsx', 'utf8');

appContent = appContent.replace(/<div <div className="absolute top-0 left-0/g, '<div className="absolute top-0 left-0');

fs.writeFileSync('./App.tsx', appContent, 'utf8');
console.log('Fixed syntax error');
