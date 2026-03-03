const fs = require('fs');
const path = require('path');

const screensDir = 'c:/tarot-user-app-withai/src/screens';
const filesToDelete = [
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

filesToDelete.forEach(file => {
    const filePath = path.join(screensDir, file);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted: ${filePath}`);
    } else {
        console.log(`File not found: ${filePath}`);
    }
});
