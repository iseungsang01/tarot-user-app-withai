/**
 * src/components/AIInsightPanel.js
 * 상담 기록 AI 요약/분석 결과 패널
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    Platform,
} from 'react-native';
import { DrawerTheme } from '../constants/DrawerTheme';
import { useSummarizeReview, useAnalyzeHistory } from '../hooks/useOpenAI';

export const AISummaryPanel = ({ reviewText, visitDate }) => {
    return <View><Text>AI Summary Panel</Text></View>;
};

export const AIHistoryAnalysisPanel = ({ visits }) => {
    return <View><Text>AI History Analysis Panel</Text></View>;
};
