const fs = require('fs');
const path = require('path');

const baseDir = 'c:/tarot-user-app-withai/src/screens';
const files = [
    'AIChatHistoryScreen.js',
    'BugReportDetailScreen.js',
    'BugReportScreen.js',
    'CouponScreen.js',
    'DailyFortuneScreen.js',
    'HistoryScreen.js',
    'LoginScreen.js',
    'NoticeDetailScreen.js',
    'NoticeScreen.js',
    'OnboardingScreen.js',
    'RegisterScreen.js',
    'SettingsScreen.js',
    'StampScreen.js',
    'VisitDetailScreen.js',
    'VoteScreen.js'
];

console.log('--- STARTING CLEANUP ---');
files.forEach(f => {
    const p = path.join(baseDir, f);
    if (fs.existsSync(p)) {
        try {
            fs.unlinkSync(p);
            const stillExists = fs.existsSync(p);
            console.log(`${f}: ${stillExists ? 'STILL EXISTS (FAILED)' : 'DELETED'}`);
        } catch (e) {
            console.log(`${f}: ERROR - ${e.message}`);
        }
    } else {
        console.log(`${f}: ALREADY GONE`);
    }
});
console.log('--- FINISHED ---');
