const fs = require('fs');
const path = require('path');

const srcDir = 'c:/tarot-user-app-withai/src';
const utilsDir = path.join(srcDir, 'utils');
const filesToMerge = ['formatters.js', 'imageOptimizer.js', 'storage.js', 'validators.js', 'errorHandler.js'];

let newIndexContent = `import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ERROR_TYPES, ERROR_MESSAGES } from '../constants';\n\n`;

filesToMerge.forEach(file => {
    const filePath = path.join(utilsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // comment out import lines to prevent duplication
    content = content.split('\n').map(line => {
        if (line.trim().startsWith('import ')) {
            return '// ' + line;
        }
        return line;
    }).join('\n');

    newIndexContent += `/* ================== ${file} ================== */\n${content}\n\n`;
});

fs.writeFileSync(path.join(utilsDir, 'index.js'), newIndexContent);

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(dirPath);
    });
}

walk(srcDir, function (filePath) {
    if (filePath.endsWith('.js')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content
            .replace(/['"]\.\.\/utils\/(errorHandler|formatters|imageOptimizer|storage|validators)['"]/g, "'../utils'")
            .replace(/['"]\.\.\/\.\.\/utils\/(errorHandler|formatters|imageOptimizer|storage|validators)['"]/g, "'../../utils'")
            .replace(/['"]\.\/utils\/(errorHandler|formatters|imageOptimizer|storage|validators)['"]/g, "'./utils'");
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent);
            console.log('Updated Utils imports in', filePath);
        }
    }
});
