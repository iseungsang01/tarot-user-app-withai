const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const screensDir = path.join(projectRoot, 'src', 'screens');

// --- NoticeScreen ---
const noticePath = path.join(screensDir, 'NoticeScreen.js');
const noticeDetailPath = path.join(screensDir, 'NoticeDetailScreen.js');

let noticeCode = fs.readFileSync(noticePath, 'utf8');
let noticeDetailCode = fs.readFileSync(noticeDetailPath, 'utf8');

noticeDetailCode = noticeDetailCode
    .replace(/^import\s+.*?(?:\n|;)/gm, '')
    .replace('export default NoticeDetailScreen;', 'export { NoticeDetailScreen };');

noticeCode = noticeCode.replace(
    "import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';",
    "import { View, Text, StyleSheet, FlatList, RefreshControl, Image, TouchableOpacity, Linking } from 'react-native';"
);

fs.writeFileSync(noticePath, noticeCode + '\n/* --- NoticeDetailScreen --- */\n' + noticeDetailCode);

// --- BugReportScreen ---
const bugPath = path.join(screensDir, 'BugReportScreen.js');
const bugDetailPath = path.join(screensDir, 'BugReportDetailScreen.js');

let bugCode = fs.readFileSync(bugPath, 'utf8');
let bugDetailCode = fs.readFileSync(bugDetailPath, 'utf8');

bugDetailCode = bugDetailCode
    .replace(/^import\s+.*?(?:\n|;)/gm, '')
    .replace('export default BugReportDetailScreen;', 'export { BugReportDetailScreen };');

bugCode = bugCode.replace(
    "import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';",
    "import { View, Text, StyleSheet, ScrollView, Alert, Image } from 'react-native';"
);

fs.writeFileSync(bugPath, bugCode + '\n/* --- BugReportDetailScreen --- */\n' + bugDetailCode);

console.log('Screens merged successfully');