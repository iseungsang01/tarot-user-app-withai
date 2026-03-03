const fs = require('fs');

// --- NoticeScreen ---
const noticePath = 'c:/tarot-user-app-withai/src/screens/NoticeScreen.js';
const noticeDetailPath = 'c:/tarot-user-app-withai/src/screens/NoticeDetailScreen.js';

let noticeCode = fs.readFileSync(noticePath, 'utf8');
let noticeDetailCode = fs.readFileSync(noticeDetailPath, 'utf8');

noticeDetailCode = noticeDetailCode
    .replace(/^import\s+.*?(?:\n|;)/gm, '') // remove imports safely
    .replace('export default NoticeDetailScreen;', 'export { NoticeDetailScreen };');

// NoticeDetailScreen uses Linking, Image, TouchableOpacity from react-native
noticeCode = noticeCode.replace(
    "import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';",
    "import { View, Text, StyleSheet, FlatList, RefreshControl, Image, TouchableOpacity, Linking } from 'react-native';"
);

fs.writeFileSync(noticePath, noticeCode + '\n/* --- NoticeDetailScreen --- */\n' + noticeDetailCode);

// --- BugReportScreen ---
const bugPath = 'c:/tarot-user-app-withai/src/screens/BugReportScreen.js';
const bugDetailPath = 'c:/tarot-user-app-withai/src/screens/BugReportDetailScreen.js';

let bugCode = fs.readFileSync(bugPath, 'utf8');
let bugDetailCode = fs.readFileSync(bugDetailPath, 'utf8');

bugDetailCode = bugDetailCode
    .replace(/^import\s+.*?(?:\n|;)/gm, '') // remove imports safely
    .replace('export default BugReportDetailScreen;', 'export { BugReportDetailScreen };');

// BugReportDetailScreen uses Image from react-native
bugCode = bugCode.replace(
    "import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';",
    "import { View, Text, StyleSheet, ScrollView, Alert, Image } from 'react-native';"
);

fs.writeFileSync(bugPath, bugCode + '\n/* --- BugReportDetailScreen --- */\n' + bugDetailCode);

console.log('Screens merged successfully');
