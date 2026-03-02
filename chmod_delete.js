const fs = require('fs');
const path = require('path');

const target = 'c:/tarot-user-app-withai/src/screens/AIChatHistoryScreen.js';

try {
    if (fs.existsSync(target)) {
        console.log('File exists.');
        // Try to remove read-only attribute if on Windows
        // But since I don't have 'child_process' easily here without writing more code, 
        // let's just try to change permissions via fs.
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
