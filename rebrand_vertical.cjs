const fs = require('fs');

let appContent = fs.readFileSync('./App.tsx', 'utf8');

// Change from horizontal flex to vertical flex
appContent = appContent.replace(/<div className="flex flex-col lg:flex-row gap-8 pb-10">/g, '<div className="flex flex-col gap-8 pb-10 max-w-5xl mx-auto w-full">');
appContent = appContent.replace(/<div className="w-full lg:w-\[320px\] flex-shrink-0 flex flex-col gap-6">/g, '<div className="w-full flex flex-col gap-6">');
appContent = appContent.replace(/<div className="flex-1 bg-genesis-card backdrop-blur-xl border border-genesis-border-default rounded-xl p-2 relative min-h-\[700px\] flex flex-col">/g, '<div className="w-full bg-genesis-card backdrop-blur-xl border border-genesis-border-default rounded-[16px] p-2 relative min-h-[700px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col mt-4">');
appContent = appContent.replace(/<div className="flex-1 bg-genesis-card\/40 border border-white\/5 rounded-xl p-2 relative min-h-\[700px\] flex flex-col">/g, '<div className="w-full bg-genesis-card backdrop-blur-xl border border-genesis-border-default rounded-[16px] p-2 relative min-h-[700px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col mt-4">');
appContent = appContent.replace(/<div className="flex-1 bg-genesis-card\/40/g, '<div className="w-full bg-genesis-card backdrop-blur-xl');


// Also let's make the "Nova Análise" settings form horizontal on Desktop if possible? Or maybe we just let it take full width. 
// "espaço da nova análise, que era para ser menor, ocupou um espaço maior"
// If it's full width, it might take huge height. So let's make it a nice compact horizontal grid.
appContent = appContent.replace(/<div className="flex flex-col gap-5">/g, '<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">');
appContent = appContent.replace(/<div className="flex flex-col gap-4 mt-6">/g, '<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">');

fs.writeFileSync('./App.tsx', appContent, 'utf8');
console.log('App layout vertically integrated');
