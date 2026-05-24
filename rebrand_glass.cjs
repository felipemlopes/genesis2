const fs = require('fs');

let indexHtml = fs.readFileSync('./index.html', 'utf8');

indexHtml = indexHtml.replace(/:root {[\s\S]*?}/, `:root {
        --color-bg-base: #000000;
        --color-bg-surface: rgba(255, 255, 255, 0.03);
        --color-bg-card: rgba(255, 255, 255, 0.03);
        --color-bg-input: rgba(255, 255, 255, 0.05);
        --color-border-subtle: rgba(255, 255, 255, 0.04);
        --color-border-default: rgba(255, 255, 255, 0.05);
        --color-text-primary: #ffffff;
        --color-text-secondary: #a1a1aa;
        --color-text-muted: #52525b;
        --color-accent: #3b82f6; 
        --color-accent-dim: rgba(59, 130, 246, 0.15);
        --color-accent-border: rgba(59, 130, 246, 0.3);
        --color-positive: #22c55e;
        --color-positive-dim: rgba(34, 197, 94, 0.15);
        --color-negative: #ef4444;
        --color-negative-dim: rgba(239, 68, 68, 0.15);
        --color-warning: #f59e0b;
      }`);

indexHtml = indexHtml.replace(/@apply text-genesis-text-primary antialiased font-normal;[\s\S]*?background-attachment: fixed;/g, 
`@apply text-genesis-text-primary antialiased font-normal;
          background-color: #050505;
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(59, 130, 246, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(34, 197, 94, 0.05) 0%, transparent 40%);
          background-attachment: fixed;`);

if (!indexHtml.includes('radial-gradient')) {
    indexHtml = indexHtml.replace(/@apply bg-genesis-base text-genesis-text-primary antialiased font-normal;/, 
    `@apply text-genesis-text-primary antialiased font-normal;
          background-color: #050505;
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(59, 130, 246, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(34, 197, 94, 0.05) 0%, transparent 40%);
          background-attachment: fixed;`);
}

fs.writeFileSync('./index.html', indexHtml, 'utf8');

let appContent = fs.readFileSync('./App.tsx', 'utf8');

// The layout the user explicitly wanted us to preserve for the grid sizes:
// It was: <div className="flex flex-col lg:flex-row gap-8 pb-10">
// the left block: className="w-full lg:w-[320px] flex-shrink-0 flex flex-col gap-6"
// the right block: className="flex-1 bg-genesis-card/40 border border-white/5 rounded-xl p-2 relative min-h-[700px] flex flex-col"

appContent = appContent.replace(/bg-genesis-surface/g, 'bg-genesis-surface backdrop-blur-2xl');
appContent = appContent.replace(/bg-genesis-card\/40/g, 'bg-genesis-card backdrop-blur-xl border border-genesis-border-default shadow-[0_8px_32px_rgba(0,0,0,0.4)]');
appContent = appContent.replace(/bg-genesis-card/g, 'bg-genesis-card backdrop-blur-xl');

// Generic border fixes for nicer translucency
appContent = appContent.replace(/border border-genesis-border /g, 'border border-genesis-border-default ');
appContent = appContent.replace(/border border-white\/5 /g, 'border border-genesis-border-default ');

// Clean up buttons and shadows
appContent = appContent.replace(/bg-gradient-to-r from-\[\#22c55e\] to-\[\#16a34a\] hover:from-\[\#16a34a\] hover:to-\[\#15803d\] text-white shadow-\[0_0_20px_rgba\(34,197,94,0\.3\)\] hover:shadow-\[0_0_30px_rgba\(34,197,94,0\.5\)\] transform hover:-translate-y-0\.5/g, 'bg-genesis-positive hover:bg-[#16a34a] text-black shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all');

// Fix primary gradient
appContent = appContent.replace(/<div className="absolute top-0 left-0 w-full h-\[1px\] bg-gradient-to-r from-transparent via-genesis-text-secondary to-transparent opacity-30"><\/div>/g, '<div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-genesis-accent to-transparent opacity-50"></div>');

// Remove double backdrop-blur-xl
appContent = appContent.replace(/backdrop-blur-xl backdrop-blur-xl/g, 'backdrop-blur-xl');
appContent = appContent.replace(/backdrop-blur-2xl backdrop-blur-2xl/g, 'backdrop-blur-2xl');

fs.writeFileSync('./App.tsx', appContent, 'utf8');
console.log('Applied beautiful glass effect to App.tsx and index.html');
