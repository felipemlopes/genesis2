const fs = require('fs');

let content = fs.readFileSync('./App.tsx', 'utf8');

// Fix dangling -2xl
content = content.replace(/-2xl/g, 'shadow-[0_0_30px_rgba(139,92,246,0.05)]');

// Fix the header styling
content = content.replace(/Terminal Genesis<\/h2>/g, 'Terminal Gênesis</h2>');

// Save it back
fs.writeFileSync('./App.tsx', content, 'utf8');

let indexHtml = fs.readFileSync('./index.html', 'utf8');
indexHtml = indexHtml.replace(/#0a0a0b/g, '#030303');
indexHtml = indexHtml.replace(/#0d0d10/g, '#0a0a0c');
indexHtml = indexHtml.replace(/#111113/g, '#0f0f13');
fs.writeFileSync('./index.html', indexHtml, 'utf8');

console.log('Fixed -2xl and background colors!');
