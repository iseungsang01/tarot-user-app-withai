const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const target = path.join(projectRoot, 'src', 'screens', 'AIChatHistoryScreen.js');

try {
    if (fs.existsSync(target)) {
        console.log('File exists.');
        fs.chmodSync(target, 0o666);
        console.log('Permission changed to 0666.');
        fs.unlinkSync(target);
        console.log('File unlinked successfully.');
    } else {
        console.log('File already gone.');
    }
} catch (e) {
    console.log('Error: ' + e.message);
}