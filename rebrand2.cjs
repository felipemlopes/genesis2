const fs = require('fs');
let appContent = fs.readFileSync('./App.tsx', 'utf8');

// The line is:
// <div className="lg:col-span-8 bg-genesis-card border border-genesis-border rounded-xl p-1 relative min-h-[600px] -2xl flex flex-col">
// Oh wait. Before, the terminal was:
// className="w-full lg:w-[340px] flex-shrink-0 bg-genesis-surface border-l border-genesis-border-subtle rounded-[10px] p-0 relative min-h-[600px] flex flex-col"
// But it couldn't find it. Let me just replace the grid structure.

appContent = appContent.replace(/className="flex flex-col lg:flex-row gap-6 pb-10"/g, 'className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10"');
appContent = appContent.replace(/className="flex-1 flex flex-col gap-\[14px\]"/g, 'className="lg:col-span-4 flex flex-col gap-6"');

// Try with part of the string
appContent = appContent.replace(/className="w-full lg:w-\[340px\][^"]*"/g, 'className="lg:col-span-8 bg-genesis-card border border-genesis-border rounded-xl p-1 relative min-h-[600px] shadow-[0_0_30px_rgba(139,92,246,0.05)] flex flex-col"');

appContent = appContent.replace(/shadow-\[0_0_10px_rgba\(57,255,20,0\.8\)\]/g, 'shadow-[0_0_15px_rgba(57,255,20,0.8)]');

fs.writeFileSync('./App.tsx', appContent, 'utf8');
console.log('Grid replace run');
