const fs = require('fs');

// 1. Update index.html
let indexHtml = fs.readFileSync('./index.html', 'utf8');
indexHtml = indexHtml.replace(/--color-accent: #f59e0b;/g, '--color-accent: #8b5cf6;');
indexHtml = indexHtml.replace(/--color-accent-dim: #f59e0b18;/g, '--color-accent-dim: #8b5cf618;');
indexHtml = indexHtml.replace(/--color-accent-border: #f59e0b40;/g, '--color-accent-border: #8b5cf640;');

indexHtml = indexHtml.replace(/--color-positive: #22c55e;/g, '--color-positive: #39ff14;');
indexHtml = indexHtml.replace(/--color-positive-dim: #22c55e18;/g, '--color-positive-dim: #39ff1418;');
fs.writeFileSync('./index.html', indexHtml, 'utf8');

// 2. Update App.tsx
let appContent = fs.readFileSync('./App.tsx', 'utf8');

// Restore Terminal / Left side grid
appContent = appContent.replace(/className="flex flex-col lg:flex-row gap-6 pb-10"/g, 'className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10"');
appContent = appContent.replace(/className="flex-1 flex flex-col gap-\[14px\]"/g, 'className="lg:col-span-4 flex flex-col gap-6"');
appContent = appContent.replace(/className="w-full lg:w-\[340px\] flex-shrink-0 bg-genesis-surface border-l border-genesis-border-subtle rounded-\[10px\] p-0 relative min-h-\[600px\] flex flex-col"/g, 'className="lg:col-span-8 bg-black/50 border border-white/5 rounded-[12px] p-2 relative min-h-[600px] flex flex-col shadow-[0_0_30px_rgba(139,92,246,0.05)]"');

// Re-add neon to Nova Analise Container (Left)
appContent = appContent.replace(/bg-genesis-card border border-genesis-border rounded-xl p-6 flex flex-col -2xl relative overflow-hidden group/g, 'bg-genesis-card border border-genesis-border rounded-[12px] p-6 flex flex-col relative overflow-hidden group shadow-[0_0_20px_rgba(139,92,246,0.05)]');

// Re-add neon glow to positive items
appContent = appContent.replace(/className="w-1.5 h-1.5 rounded-full bg-genesis-positive animate-pulse"/g, 'className="w-1.5 h-1.5 rounded-full bg-genesis-positive shadow-[0_0_10px_rgba(57,255,20,0.8)] animate-pulse"');

// Restore Terminal input styles
appContent = appContent.replace(/w-full bg-black border border-white\/10 rounded-lg px-3 py-3 text-xs text-white appearance-none focus:border-genesis-accent focus:outline-none transition-all focus:-\[0_0_15px_rgba\(139,92,246,0.1\)\]/g, 'w-full bg-[#0d0d10] border border-white/10 rounded-lg px-3 py-3 text-xs text-white appearance-none focus:border-genesis-accent focus:outline-none transition-all focus:shadow-[0_0_15px_rgba(139,92,246,0.2)]');
appContent = appContent.replace(/w-full bg-black border border-white\/10 rounded-lg px-3 py-3 text-xs text-white focus:border-genesis-accent focus:outline-none transition-all placeholder-gray-700 font-mono appearance-none/g, 'w-full bg-[#0d0d10] border border-white/10 rounded-lg px-3 py-3 text-xs text-white focus:border-genesis-accent focus:outline-none transition-all focus:shadow-[0_0_15px_rgba(139,92,246,0.2)] placeholder-gray-700 font-mono appearance-none');
appContent = appContent.replace(/w-full bg-black border border-white\/10 rounded-lg px-3 py-3 text-xs text-white appearance-none focus:border-genesis-accent focus:outline-none transition-all/g, 'w-full bg-[#0d0d10] border border-white/10 rounded-lg px-3 py-3 text-xs text-white appearance-none focus:border-genesis-accent focus:outline-none transition-all focus:shadow-[0_0_15px_rgba(139,92,246,0.2)]');

// Change logo back to neon
appContent = appContent.replace(/<div className="w-7 h-7 rounded-md border border-genesis-border flex items-center justify-center bg-white\/\[0.03\]">/g, '<div className="w-8 h-8 rounded-lg border border-genesis-accent/30 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.3)] bg-genesis-accent/10">');

// Re-add shadow box around Terminal result content
appContent = appContent.replace(/<div className="h-full bg-black rounded-lg border border-white\/5 p-4 md:p-8 overflow-hidden relative ">/g, '<div className="h-full bg-black rounded-lg border border-white/5 p-4 md:p-8 overflow-hidden relative shadow-inner">');

// Fix primary color bar (top of new analysis)
appContent = appContent.replace(/<div className="absolute top-0 left-0 w-full h-0.5   primary\/50  opacity-50"><\/div>/g, '<div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-genesis-accent to-transparent opacity-50"></div>');

fs.writeFileSync('./App.tsx', appContent, 'utf8');
console.log('Rebranding applied successfully!');
