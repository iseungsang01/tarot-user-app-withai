const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(dirPath);
    });
}

walk('c:/tarot-user-app-withai/src', function (filePath) {
    if (filePath.endsWith('.js')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content
            .replace(/['"]\.\.\/constants\/(Colors|Config|DrawerTheme|ErrorMessages)['"]/g, "'../constants'")
            .replace(/['"]\.\.\/\.\.\/constants\/(Colors|Config|DrawerTheme|ErrorMessages)['"]/g, "'../../constants'")
            .replace(/['"]\.\/constants\/(Colors|Config|DrawerTheme|ErrorMessages)['"]/g, "'./constants'");
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent);
            console.log('Updated', filePath);
        }
    }
});
