const fs = require('fs');
const glob = require('glob');

const files = glob.sync('components/*.tsx');

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    
    if (content.includes('bottom-full')) {
        content = content.replace(/bottom-full/g, 'top-[calc(100%+10px)]');
        content = content.replace(/mb-3/g, 'mt-3');
        content = content.replace(/mb-2/g, 'mt-2');
        content = content.replace(/origin-bottom/g, 'origin-top');
        content = content.replace(/-bottom-1\.5 left-1\/2 -translate-x-1\/2 w-3 h-3 bg-([a-zA-Z0-9\-\/]+) border-r border-b/g, '-top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-$1 border-l border-t');
        
        fs.writeFileSync(file, content, 'utf8');
    }
}
console.log('Fixed all tooltips in components.');
