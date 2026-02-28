const fs = require('fs');
const path = require('path');

const srcDir = 'c:/tarot-user-app-withai/src';
const appJsPath = 'c:/tarot-user-app-withai/App.js';

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(dirPath);
    });
}

const replaceImports = (filePath) => {
    if (filePath.endsWith('.js')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content
            .replace(/['"]\.\.\/context\/AuthContext['"]/g, "'../context/AppContext'")
            .replace(/['"]\.\.\/context\/ErrorContext['"]/g, "'../context/AppContext'")
            .replace(/['"]\.\.\/\.\.\/context\/AuthContext['"]/g, "'../../context/AppContext'")
            .replace(/['"]\.\.\/\.\.\/context\/ErrorContext['"]/g, "'../../context/AppContext'")
            .replace(/['"]\.\/context\/AuthContext['"]/g, "'./context/AppContext'")
            .replace(/['"]\.\/context\/ErrorContext['"]/g, "'./context/AppContext'")

            // also replace in App.js root file
            .replace(/['"]\.\/src\/context\/AuthContext['"]/g, "'./src/context/AppContext'")
            .replace(/['"]\.\/src\/context\/ErrorContext['"]/g, "'./src/context/AppContext'");

        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent);
            console.log('Updated Context imports in', filePath);
        }
    }
};

walk(srcDir, replaceImports);
replaceImports(appJsPath);
