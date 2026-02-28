const fs = require('fs');
const path = require('path');

const srcDir = 'c:/tarot-user-app-withai/src';

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
            .replace(/['"]\.\.\/styles\/CommonStyles['"]/g, "'../styles'")
            .replace(/['"]\.\.\/\.\.\/styles\/CommonStyles['"]/g, "'../../styles'")
            .replace(/['"]\.\/styles\/CommonStyles['"]/g, "'./styles'")

            .replace(/import\s+\{\s*styles\s*\}\s+from\s+['"]\.\.\/styles\/SettingsStyles['"]/g, "import { SettingsStyles as styles } from '../styles'")
            .replace(/import\s+\{\s*styles\s*\}\s+from\s+['"]\.\.\/\.\.\/styles\/SettingsStyles['"]/g, "import { SettingsStyles as styles } from '../../styles'")
            .replace(/import\s+\{\s*styles\s*\}\s+from\s+['"]\.\/styles\/SettingsStyles['"]/g, "import { SettingsStyles as styles } from './styles'");

        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent);
            console.log('Updated Styles imports in', filePath);
        }
    }
};

walk(srcDir, replaceImports);
