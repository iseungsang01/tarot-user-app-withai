const fs = require('fs');
const path = require('path');

// 스크립트 위치: scripts/maintenance/update_context.js
// 프로젝트 루트는 두 단계 상위 디렉토리
const projectRoot = path.resolve(__dirname, '..', '..');
const srcDir = path.join(projectRoot, 'src');
const appJsPath = path.join(projectRoot, 'App.js');

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