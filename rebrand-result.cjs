const fs = require('fs');

let content = fs.readFileSync('./components/AnalysisResult.tsx', 'utf8');

// Replace bg-genesis-positive/10 or text-genesis-positive with neon friendly styling
content = content.replace(/bg-genesis-positive\/10 text-genesis-positive border border-genesis-positive\/30/g, 'bg-genesis-positive/10 text-genesis-positive border border-genesis-positive/30 shadow-[0_0_15px_rgba(57,255,20,0.15)]');

content = content.replace(/bg-green-500\/10/g, 'bg-genesis-positive/10');
content = content.replace(/text-green-500/g, 'text-genesis-positive');
content = content.replace(/border-green-500\/30/g, 'border-genesis-positive/30');

// Red / Negative 
content = content.replace(/text-red-500/g, 'text-genesis-negative');
content = content.replace(/bg-red-500\/10/g, 'bg-genesis-negative/10');
content = content.replace(/border-red-500\/30/g, 'border-genesis-negative/30');

fs.writeFileSync('./components/AnalysisResult.tsx', content, 'utf8');
console.log('AnalysisResult styles updated!');
