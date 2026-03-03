const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const baseDir = path.join(projectRoot, 'src', 'screens');

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

console.log('--- Deletion Process Starting ---');
files.forEach(f => {
    const p = path.join(baseDir, f);
    if (fs.existsSync(p)) {
        try {
            fs.unlinkSync(p);
            console.log(`[SUCCESS] Deleted: ${f}`);
        } catch (e) {
            console.log(`[ERROR] Failed to delete ${f}: ${e.message}`);
        }
    } else {
        console.log(`[SKIP] Already gone: ${f}`);
    }
});
console.log('--- Process Finished ---');