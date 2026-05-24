const fs = require('fs');

let indexHtml = fs.readFileSync('./index.html', 'utf8');
// Base institutional dark palette
indexHtml = indexHtml.replace(/--color-bg-base: .*/g, '--color-bg-base: #020202;');
indexHtml = indexHtml.replace(/--color-bg-surface: .*/g, '--color-bg-surface: #0a0a0a;');
indexHtml = indexHtml.replace(/--color-bg-card: .*/g, '--color-bg-card: #0f0f11;');
indexHtml = indexHtml.replace(/--color-bg-input: .*/g, '--color-bg-input: #0a0a0a;');
indexHtml = indexHtml.replace(/--color-border-subtle: .*/g, '--color-border-subtle: #1f1f22;');
indexHtml = indexHtml.replace(/--color-border-default: .*/g, '--color-border-default: #26262a;');

// Vibrant tech colors
indexHtml = indexHtml.replace(/--color-accent: .*/g, '--color-accent: #60a5fa;'); // institutional blue
indexHtml = indexHtml.replace(/--color-accent-dim: .*/g, '--color-accent-dim: #60a5fa18;');
indexHtml = indexHtml.replace(/--color-accent-border: .*/g, '--color-accent-border: #60a5fa40;');

indexHtml = indexHtml.replace(/--color-positive: .*/g, '--color-positive: #10b981;'); // institutional emerald/green
indexHtml = indexHtml.replace(/--color-positive-dim: .*/g, '--color-positive-dim: #10b98118;');

fs.writeFileSync('./index.html', indexHtml, 'utf8');
console.log('Institutional colors written');
