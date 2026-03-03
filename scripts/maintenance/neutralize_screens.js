const fs = require('fs');
const path = require('path');

const baseDir = 'c:/tarot-user-app-withai/src/screens';
const mapping = {
    'AIChatHistoryScreen.js': './history/AIChatHistoryScreen',
    'BugReportDetailScreen.js': './settings/BugReportDetailScreen',
    'BugReportScreen.js': './settings/BugReportScreen',
    'CouponScreen.js': './settings/CouponScreen',
    'DailyFortuneScreen.js': './fortune/DailyFortuneScreen',
    'HistoryScreen.js': './history/HistoryScreen',
    'LoginScreen.js': './auth/LoginScreen',
    'NoticeDetailScreen.js': './notice/NoticeDetailScreen',
    'NoticeScreen.js': './notice/NoticeScreen',
    'OnboardingScreen.js': './auth/OnboardingScreen',
    'RegisterScreen.js': './auth/RegisterScreen',
    'SettingsScreen.js': './settings/SettingsScreen',
    'StampScreen.js': './settings/StampScreen',
    'VisitDetailScreen.js': './history/VisitDetailScreen',
    'VoteScreen.js': './vote/VoteScreen'
};

Object.entries(mapping).forEach(([oldFile, newPath]) => {
    const p = path.join(baseDir, oldFile);
    const content = `// This file is deprecated. Please use ${newPath} instead.\nexport { default } from '${newPath}';\n`;
    fs.writeFileSync(p, content);
    console.log(`Neutralized: ${oldFile}`);
});
