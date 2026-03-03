const fs = require('fs');
const path = require('path');
const logFile = 'delete_log.txt';

const baseDir = 'c:/tarot-user-app-withai/src/screens';
const files = [
    'AIChatHistoryScreen.js',
    'BugReportDetailScreen.js',
    'BugReportScreen.js',
    'CouponScreen.js',
    'DailyFortuneScreen.js',
    'HistoryScreen.js',
    'NoticeDetailScreen.js',
    'NoticeScreen.js',
    'OnboardingScreen.js',
    'RegisterScreen.js',
    'SettingsScreen.js',
    'StampScreen.js',
    'VisitDetailScreen.js',
    'VoteScreen.js'
];

let logContent = 'Starting deletion...\n';

files.forEach(f => {
    const p = path.join(baseDir, f);
    if (fs.existsSync(p)) {
        try {
            fs.unlinkSync(p);
            logContent += `DELETED: ${f}\n`;
        } catch (e) {
            logContent += `FAILED: ${f} - ${e.message}\n`;
        }
    } else {
        logContent += `NOT FOUND: ${f}\n`;
    }
});

fs.writeFileSync(logFile, logContent);
console.log('Done.');
