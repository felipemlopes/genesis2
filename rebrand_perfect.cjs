const fs = require('fs');

let appContent = fs.readFileSync('./App.tsx', 'utf8');

// Sidebar styling fixes
appContent = appContent.replace(
  /<aside className="w-\[200px\] border-r border-genesis-border flex flex-col bg-genesis-surface backdrop-blur-2xl hidden md:flex">/g,
  '<aside className="w-[240px] border-r border-white/[0.03] flex flex-col bg-[#050505] shadow-[10px_0_30px_rgba(0,0,0,0.6)] z-30 hidden md:flex relative">'
);

// Optimize line thickness generally by making borders extremely subtle 
appContent = appContent.replace(/border-genesis-border/g, 'border-white/[0.03]');
appContent = appContent.replace(/border-genesis-border-default/g, 'border-white/[0.03]');

// Fix Hover effect on Sidebar Navigation
const sidebarItemRegex = /className=\{`w-full flex items-center gap-3 px-2 py-\[7px\] rounded-md transition-all duration-150 group mb-\[2px\] \$\{activeTab === item\.id \? '[^']+' : '[^']+'\}`\}/g;
appContent = appContent.replace(sidebarItemRegex, 
  "className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 group mb-[2px] ${activeTab === item.id ? 'bg-genesis-accent/[0.1] text-white shadow-[0_0_15px_rgba(176,38,255,0.1)] border border-genesis-accent/20' : 'text-genesis-text-secondary hover:text-white hover:bg-genesis-accent/[0.05] border border-transparent'}`}"
);

// Fix Icon states in sidebar
const sidebarIconRegex = /className=\{`flex-shrink-0 transition-colors \$\{activeTab === item\.id \? '[^']+' : '[^']+'\}`\}/g;
appContent = appContent.replace(sidebarIconRegex, 
  "className={`flex-shrink-0 transition-all duration-300 ${activeTab === item.id ? 'text-genesis-accent drop-shadow-[0_0_8px_rgba(176,38,255,0.8)]' : 'text-genesis-text-muted group-hover:text-genesis-accent group-hover:drop-shadow-[0_0_5px_rgba(176,38,255,0.4)]'}`}"
);

// Fix layout of the "Nova Análise" tab
// Previously it was stacked vertically:
appContent = appContent.replace(
  /<div className="flex flex-col gap-8 pb-10 max-w-7xl mx-auto w-full">/g, 
  '<div className="flex flex-col lg:flex-row gap-6 pb-10 w-full">'
);
appContent = appContent.replace(
  /<div className="w-full flex flex-col gap-6">[\s\S]*?(<div className="flex-1 bg-genesis-card)/,
  `<div className="w-full lg:w-[360px] xl:w-[400px] flex-shrink-0 flex flex-col gap-6">\n$1` // The second block starts with flex-1
);

// Fix right block (Terminal) being vertically stacked instead of flex-row sibling
// The original was flex-1 -> actually there's a `<div className="w-full bg-genesis-card backdrop-blur-xl border border-genesis-border-default rounded-[16px] p-2 relative min-h-[700px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col mt-4">`
appContent = appContent.replace(
  /<div className="w-full bg-genesis-card backdrop-blur-xl border border-genesis-border-default rounded-\[16px\] p-2 relative min-h-\[700px\] shadow-\[0_8px_32px_rgba([^\]]+)\] flex flex-col mt-4">/g,
  '<div className="flex-1 bg-[#050505] border border-white/[0.03] rounded-[16px] p-2 relative min-h-[700px] shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col">'
);
appContent = appContent.replace(
  /<div className="w-full bg-genesis-card backdrop-blur-xl border border-white\/\[0\.03\] rounded-\[16px\] p-2 relative min-h-\[700px\] shadow-\[0_8px_32px_rgba\([^\]]+\)\] flex flex-col mt-4">/g,
  '<div className="flex-1 bg-[#050505] border border-white/[0.03] rounded-[16px] p-2 relative min-h-[700px] shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col">'
);

// Change `w-full` for the left side (since I replaced the container but let's be sure of the container)
const leftFormBlock = /<div className="w-full flex flex-col gap-6">/g;
appContent = appContent.replace(leftFormBlock, '<div className="w-full lg:w-[320px] xl:w-[360px] flex-shrink-0 flex flex-col gap-6">');

// The layout was: `<div className="flex flex-col gap-8 pb-10 max-w-7xl mx-auto w-full">`
// Wait, I already replaced that. 

// Restore form inputs to stack if they were spread out horizontally
appContent = appContent.replace(/<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">/g, '<div className="flex flex-col gap-5">');
appContent = appContent.replace(/<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">/g, '<div className="flex flex-col gap-4 mt-6">');

// Fix the "Analisar Agora" button tooltip/hover state to use the neon positive color (neon green)
appContent = appContent.replace(
  /bg-genesis-positive hover:opacity-90 text-black shadow-\[0_0_20px_rgba\(16,185,129,0\.3\)\] hover:shadow-\[0_0_30px_rgba\(16,185,129,0\.5\)\] transition-all duration-300/g,
  'bg-genesis-positive hover:opacity-80 text-black shadow-[0_0_20px_rgba(57,255,20,0.4)] hover:shadow-[0_0_30px_rgba(57,255,20,0.6)] transition-all duration-300 transform hover:scale-[1.02]'
);

// Remove the `z-10` from the header as it pushes tooltips underneath it.
appContent = appContent.replace(
  /<header className="h-\[46px\] border-b border-white\/\[0\.03\] flex items-center justify-between px-8 bg-genesis-surface backdrop-blur-2xl border-genesis-border-subtle z-10 relative">/g,
  '<header className="h-[46px] border-b border-white/[0.03] flex items-center justify-between px-8 bg-[#050505] relative z-0 shadow-[0_10px_20px_rgba(0,0,0,0.3)]">'
);
// In case the old border logic is still there:
appContent = appContent.replace(
  /<header className="h-\[46px\] border-b border-genesis-border flex items-center justify-between px-8 bg-genesis-surface backdrop-blur-2xl border-genesis-border-subtle z-10 relative">/g,
  '<header className="h-[46px] border-b border-white/[0.03] flex items-center justify-between px-8 bg-[#050505] relative z-0 shadow-[0_10px_20px_rgba(0,0,0,0.3)]">'
);

// Make the Nova Análise container sleeker
appContent = appContent.replace(
  /className="bg-genesis-card backdrop-blur-xl border border-white\/\[0\.03\] rounded-\[16px\] p-6 lg:p-8 flex flex-col relative overflow-hidden shadow-\[0_8px_32px_rgba\(0,0,0,0\.3\)\]"/g,
  'className="bg-[#050505] border border-white/[0.03] rounded-[16px] p-6 lg:p-8 flex flex-col relative overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.4)]"'
);

// Fix tooltip hidden in TrendQuality (or anything) by adding z-50
// E.g. anything that is a tooltip likely doesn't have a high z. Actually this is often handled recursively by a portal, but if it relies on stacking, relative parent must have higher stacking. We fixed the Header's z-10, so tooltips in the body will naturally show above it, as long as the scroll container has appropriate isolation.

fs.writeFileSync('./App.tsx', appContent, 'utf8');
console.log('App layout perfectly rebranded');
