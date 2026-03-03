const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const srcDir = path.join(projectRoot, 'src');
const compDir = path.join(srcDir, 'components');

const stripImports = (content) => {
    return content.replace(/^import\s+.*?(?:\n|;)/gm, '').trim();
};

// 1. HistoryComponents.js
const historyFilterBar = fs.readFileSync(path.join(compDir, 'history/HistoryFilterBar.js'), 'utf8');
const historyHeader = fs.readFileSync(path.join(compDir, 'history/HistoryHeader.js'), 'utf8');

fs.writeFileSync(path.join(compDir, 'HistoryComponents.js'), `import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerTheme } from '../constants';
import { CommonStyles } from '../styles';

${stripImports(historyFilterBar)}

${stripImports(historyHeader)}
`);

// 2. VoteComponents.js
const voteDetail = fs.readFileSync(path.join(compDir, 'vote/VoteDetail.js'), 'utf8');
const voteList = fs.readFileSync(path.join(compDir, 'vote/VoteList.js'), 'utf8');
const voteResultBar = fs.readFileSync(path.join(compDir, 'vote/VoteResultBar.js'), 'utf8');

fs.writeFileSync(path.join(compDir, 'VoteComponents.js'), `import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { VoteCard } from './VoteCard';
import { DrawerTheme } from '../constants';
import { CommonStyles } from '../styles';

${stripImports(voteDetail)}

${stripImports(voteList)}

${stripImports(voteResultBar)}
`);

// 3. SettingComponents.js
const settingDeleteAccount = fs.readFileSync(path.join(compDir, 'SettingDeleteAccount.js'), 'utf8');
const settingPasswordForm = fs.readFileSync(path.join(compDir, 'SettingPasswordForm.js'), 'utf8');
const settingReportManager = fs.readFileSync(path.join(compDir, 'SettingReportManager.js'), 'utf8');

fs.writeFileSync(path.join(compDir, 'SettingComponents.js'), `import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CustomButton } from './CustomButton';
import { SettingsStyles as styles } from '../styles';
import { compressImage } from '../utils';

${stripImports(settingDeleteAccount)}

${stripImports(settingPasswordForm)}

${stripImports(settingReportManager)}
`);

// 4. Update References globally
function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) walk(dirPath, callback);
        else callback(dirPath);
    });
}

const replaceImports = (filePath) => {
    if (filePath.endsWith('.js')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content
            .replace(/import\s+\{([^}]+)\}\s+from\s+['"](?:\.\.\/)*components\/history\/([^'"]+)['"]/g, "import {$1} from '../components/HistoryComponents'")
            .replace(/import\s+\{([^}]+)\}\s+from\s+['"](?:\.\.\/)*components\/vote\/([^'"]+)['"]/g, "import {$1} from '../components/VoteComponents'")
            .replace(/import\s+\{([^}]+)\}\s+from\s+['"](?:\.\.\/)*components\/Setting([^'"]+)['"]/g, "import {$1} from '../components/SettingComponents'")
            .replace(/import\s+\{([^}]+)\}\s+from\s+['"]\.\/history\/([^'"]+)['"]/g, "import {$1} from './HistoryComponents'")
            .replace(/import\s+\{([^}]+)\}\s+from\s+['"]\.\/vote\/([^'"]+)['"]/g, "import {$1} from './VoteComponents'")
            .replace(/import\s+\{([^}]+)\}\s+from\s+['"]\.\/Setting([^'"]+)['"]/g, "import {$1} from './SettingComponents'");

        newContent = newContent
            .replace(/from\s+['"]\.\.\/components\/history\/(HistoryFilterBar|HistoryHeader)['"]/g, "from '../components/HistoryComponents'")
            .replace(/from\s+['"]\.\.\/components\/vote\/(VoteDetail|VoteList|VoteResultBar)['"]/g, "from '../components/VoteComponents'")
            .replace(/from\s+['"]\.\.\/components\/(SettingDeleteAccount|SettingPasswordForm|SettingReportManager)['"]/g, "from '../components/SettingComponents'")
            .replace(/from\s+['"]\.\/history\/(HistoryFilterBar|HistoryHeader)['"]/g, "from './HistoryComponents'")
            .replace(/from\s+['"]\.\/vote\/(VoteDetail|VoteList|VoteResultBar)['"]/g, "from './VoteComponents'")
            .replace(/from\s+['"]\.\/(SettingDeleteAccount|SettingPasswordForm|SettingReportManager)['"]/g, "from './SettingComponents'");

        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent);
            console.log('Updated Component imports in', filePath);
        }
    }
};

walk(srcDir, replaceImports);