const fs = require('fs');

let content = fs.readFileSync('./App.tsx', 'utf8');

content = content.replace(/className="lg:col-span-4 flex flex-col gap-6"/g, 'className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6"');
content = content.replace(/className="lg:col-span-8 bg-genesis-card/g, 'className="lg:col-span-8 xl:col-span-9 bg-genesis-card');

fs.writeFileSync('./App.tsx', content, 'utf8');
console.log('Grid changed to 3 / 9 on XL screens');
