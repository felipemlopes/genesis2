const fs = require('fs');

let indexHtml = fs.readFileSync('./index.html', 'utf8');
indexHtml = indexHtml.replace(/--color-bg-base: .*/g, '--color-bg-base: #0a0a0b;');
indexHtml = indexHtml.replace(/--color-bg-surface: .*/g, '--color-bg-surface: #0d0d10;');
indexHtml = indexHtml.replace(/--color-bg-card: .*/g, '--color-bg-card: #111113;');
indexHtml = indexHtml.replace(/--color-bg-input: .*/g, '--color-bg-input: #0d0d10;');
indexHtml = indexHtml.replace(/--color-border-subtle: .*/g, '--color-border-subtle: #1a1a1e;');
indexHtml = indexHtml.replace(/--color-border-default: .*/g, '--color-border-default: #1e1e22;');

indexHtml = indexHtml.replace(/--color-accent: .*/g, '--color-accent: #f59e0b;'); // orange 
indexHtml = indexHtml.replace(/--color-accent-dim: .*/g, '--color-accent-dim: #f59e0b18;');
indexHtml = indexHtml.replace(/--color-accent-border: .*/g, '--color-accent-border: #f59e0b40;');

indexHtml = indexHtml.replace(/--color-positive: .*/g, '--color-positive: #22c55e;'); // green
indexHtml = indexHtml.replace(/--color-positive-dim: .*/g, '--color-positive-dim: #22c55e18;');

fs.writeFileSync('./index.html', indexHtml, 'utf8');
console.log('Original colors restored');
