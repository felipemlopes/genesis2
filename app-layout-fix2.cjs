const fs = require('fs');

let appContent = fs.readFileSync('./App.tsx', 'utf8');

appContent = appContent.replace(/<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10">/g, '<div className="flex flex-col lg:flex-row gap-8 pb-10">');
appContent = appContent.replace(/className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6"/g, 'className="w-full lg:w-[320px] flex-shrink-0 flex flex-col gap-6"');
appContent = appContent.replace(/className="lg:col-span-8 xl:col-span-9 bg-genesis-card border border-genesis-border rounded-xl p-1 relative min-h-\[600px\] shadow-\[0_0_30px_rgba\(139,92,246,0\.05\)\] flex flex-col"/g, 'className="flex-1 bg-genesis-card/40 border border-white/5 rounded-xl p-2 relative min-h-[700px] flex flex-col"');
appContent = appContent.replace(/className="lg:col-span-8 xl:col-span-9 bg-genesis-card border border-genesis-border rounded-xl p-1 relative min-h-\[600px\] flex flex-col"/g, 'className="flex-1 bg-genesis-card/40 border border-white/5 rounded-xl p-2 relative min-h-[700px] flex flex-col"');

// Fix styling of the "Nova Análise" wrapper
appContent = appContent.replace(/className="bg-genesis-card border border-genesis-border rounded-\[12px\] p-6 flex flex-col relative overflow-hidden group shadow-\[0_0_20px_rgba\(139,92,246,0\.05\)\]"/g, 'className="bg-genesis-surface border border-white/5 rounded-xl p-6 flex flex-col relative overflow-hidden group"');
appContent = appContent.replace(/className="bg-genesis-card border border-genesis-border rounded-\[12px\] p-6 flex flex-col -2xl relative overflow-hidden group"/g, 'className="bg-genesis-surface border border-white/5 rounded-xl p-6 flex flex-col relative overflow-hidden group"');
appContent = appContent.replace(/className="absolute top-0 left-0 w-full h-0\.5 bg-gradient-to-r from-transparent via-genesis-accent to-transparent opacity-50"><\/div>/g, '<div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-genesis-text-secondary to-transparent opacity-30"></div>');

// Inputs styling -> darker, more square
appContent = appContent.replace(/rounded-lg px-3 py-3 text-xs text-white appearance-none focus:border-genesis-accent focus:outline-none transition-all focus:shadow-\[0_0_15px_rgba\(139,92,246,0\.2\)\]/g, 'rounded-md px-3 py-2.5 text-xs text-white appearance-none focus:border-white/20 focus:outline-none transition-all');
appContent = appContent.replace(/rounded-lg px-3 py-3 text-xs text-white focus:border-genesis-accent focus:outline-none transition-all focus:shadow-\[0_0_15px_rgba\(139,92,246,0\.2\)\] placeholder-gray-700 font-mono appearance-none/g, 'rounded-md px-3 py-2.5 text-xs text-white focus:border-white/20 focus:outline-none transition-all placeholder-gray-700 font-mono appearance-none');
appContent = appContent.replace(/w-full bg-\[\#0d0d10\] border/g, 'w-full bg-[#050505] border');

// Fix Terminal inner wrapper
appContent = appContent.replace(/<div className="h-full bg-black rounded-lg border border-white\/5 p-4 md:p-8 overflow-hidden relative shadow-inner">/g, '<div className="h-full bg-[#050505] rounded-lg border border-white/5 p-4 md:p-8 overflow-hidden relative shadow-inner">');

// Clean up glowing logo
appContent = appContent.replace(/<div className="w-8 h-8 rounded-lg border border-genesis-accent\/30 flex items-center justify-center shadow-\[0_0_15px_rgba\(139,92,246,0\.3\)\] bg-genesis-accent\/10">/g, '<div className="w-7 h-7 rounded-md border border-genesis-border flex items-center justify-center bg-white/[0.03]">');

// Fix Analisar Agora button
appContent = appContent.replace(/py-4 rounded-xl font-bold tracking-\[0\.15em\] text-xs flex items-center/g, 'py-3.5 rounded-lg font-bold tracking-widest text-[11px] flex items-center');

fs.writeFileSync('./App.tsx', appContent, 'utf8');
console.log('App layout fixed!');
