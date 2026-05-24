const fs = require('fs');
const glob = require('fs').readdirSync;
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const targetExtensions = ['.tsx', '.ts', '.css'];

walkDir('.', function(filePath) {
    if (!targetExtensions.some(ext => filePath.endsWith(ext))) return;
    if (filePath.includes('node_modules')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/ -\[/g, ' shadow-[');
    content = content.replace(/ -xl/g, ' shadow-xl');
    content = content.replace(/ -lg/g, ' shadow-lg');
    content = content.replace(/ -md/g, ' shadow-md');
    content = content.replace(/ -sm/g, ' shadow-sm');
    content = content.replace(/ -2xl/g, ' shadow-2xl');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed shadows in ${filePath}`);
    }
});
