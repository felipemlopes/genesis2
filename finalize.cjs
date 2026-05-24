const fs = require('fs');

let indexHtml = fs.readFileSync('./index.html', 'utf8');

// Ensure font is set correctly and the glassy look is fully realized
indexHtml = indexHtml.replace(/:root {[\s\S]*?}/, `:root {
        --color-bg-base: #030305;
        --color-bg-surface: rgba(10, 10, 15, 0.4);
        --color-bg-card: rgba(15, 15, 20, 0.5);
        --color-bg-input: rgba(0, 0, 0, 0.4);
        --color-border-subtle: rgba(255, 255, 255, 0.03);
        --color-border-default: rgba(255, 255, 255, 0.06);
        --color-text-primary: #f8fafc;
        --color-text-secondary: #94a3b8;
        --color-text-muted: #64748b;
        --color-accent: #3b82f6; 
        --color-accent-dim: rgba(59, 130, 246, 0.1);
        --color-accent-border: rgba(59, 130, 246, 0.2);
        --color-positive: #10b981;
        --color-positive-dim: rgba(16, 185, 129, 0.1);
        --color-negative: #ef4444;
        --color-negative-dim: rgba(239, 68, 68, 0.1);
        --color-warning: #f59e0b;
      }`);

indexHtml = indexHtml.replace(/background-image:[\s\S]*?background-attachment: fixed;/, 
`background-image: 
            radial-gradient(circle at 15% 30%, rgba(34, 197, 94, 0.04) 0%, transparent 45%),
            radial-gradient(circle at 85% 70%, rgba(59, 130, 246, 0.04) 0%, transparent 45%);
          background-attachment: fixed;`);

fs.writeFileSync('./index.html', indexHtml, 'utf8');

let appContent = fs.readFileSync('./App.tsx', 'utf8');

// Let's refine the fonts and spaces
// Clean up heavy colors
appContent = appContent.replace(/text-gray-500/g, 'text-genesis-text-secondary');
appContent = appContent.replace(/text-gray-400/g, 'text-genesis-text-secondary');
appContent = appContent.replace(/text-gray-600/g, 'text-genesis-text-muted');

// Improve "Analisar Agora" button readability and style
appContent = appContent.replace(/bg-genesis-positive hover:bg-\[\#16a34a\] text-black shadow-lg hover:shadow-xl hover:scale-\[1.02\] transition-all/g, 'bg-genesis-positive hover:opacity-90 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all duration-300');

// Fix the Nova Análise wrapper to look more premium
appContent = appContent.replace(/className="bg-genesis-surface backdrop-blur-2xl border border-genesis-border-default rounded-xl p-6 flex flex-col relative overflow-hidden group"/g, 'className="bg-genesis-card backdrop-blur-xl border border-genesis-border-default rounded-[16px] p-6 lg:p-8 flex flex-col relative overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)]"');

// Fix input lines
appContent = appContent.replace(/className="w-full bg-genesis-input backdrop-blur-md/g, 'className="w-full bg-genesis-input backdrop-blur-md shadow-inner');

// Remove excessive flex-1 on right blocks that now are stacked
appContent = appContent.replace(/className="flex-1 bg-genesis-card backdrop-blur-xl/g, 'className="w-full bg-genesis-card backdrop-blur-xl');
appContent = appContent.replace(/className="flex flex-col gap-8 pb-10 max-w-5xl mx-auto w-full"/g, 'className="flex flex-col gap-8 pb-10 max-w-7xl mx-auto w-full"');

// Tweak AnalysisResult component classes in its own file if we need
fs.writeFileSync('./App.tsx', appContent, 'utf8');

let resultComponent = fs.readFileSync('./components/AnalysisResult.tsx', 'utf8');
resultComponent = resultComponent.replace(/bg-genesis-card/g, 'bg-transparent');
resultComponent = resultComponent.replace(/shadow-inner/g, '');
resultComponent = resultComponent.replace(/border-genesis-border/g, 'border-genesis-border-default');
fs.writeFileSync('./components/AnalysisResult.tsx', resultComponent, 'utf8');

console.log('Final polish done.');
