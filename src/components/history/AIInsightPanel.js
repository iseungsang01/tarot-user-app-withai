/**
 * src/components/AIInsightPanel.js
 * 상담 기록 AI 요약/분석 결과 패널
 * VisitDetailScreen 또는 HistoryScreen에서 사용
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { TextColors } from '../../constants/Colors';
import { useSummarizeReview, useAnalyzeHistory } from '../../hooks/useAI';

export const AISummaryPanel = React.memo(({ reviewText, visitDate, initialResult = null, onResult, onClear }) => {
    const { result, loading, error, summarize, reset } = useSummarizeReview();
    const [expanded, setExpanded] = useState(!!initialResult);

    useEffect(() => {
        if (initialResult) {
            setExpanded(true);
        }
    }, [initialResult]);

    const handleAnalyze = async () => {
        setExpanded(true);
        await summarize(reviewText, visitDate);
    };

    const handleReset = () => {
        reset();
        setExpanded(false);
        onClear?.();
    };

    useEffect(() => {
        if (result) {
            onResult?.(result);
        }
    }, [result, onResult]);

    const moodColorMap = {
        '긍정적': '#4CAF50',
        '중립': DrawerTheme.goldBright,
        '복잡': '#FF9800',
        '어려움': '#F44336',
    };

    if (!reviewText?.trim()) return null;

    return (
        <View style={styles.container}>
            {!expanded ? (
                <TouchableOpacity style={styles.triggerButton} onPress={handleAnalyze} activeOpacity={0.8}>
                    <Text style={styles.triggerIcon}>✨</Text>
                    <Text style={styles.triggerText}>AI로 이 기록 분석하기</Text>
                    <Text style={styles.triggerArrow}>›</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.panel}>
                    <View style={styles.panelHeader}>
                        <Text style={styles.panelTitle}>✨ AI 인사이트</Text>
                        <TouchableOpacity onPress={handleReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {loading && (
                        <View style={styles.loadingArea}>
                            <ActivityIndicator size="small" color={DrawerTheme.goldBright} />
                            <Text style={styles.loadingText}>AI가 기록을 분석하고 있습니다...</Text>
                        </View>
                    )}

                    {error && !loading && (
                        <View style={styles.errorArea}>
                            <Text style={styles.errorText}>⚠️ {error}</Text>
                            <TouchableOpacity style={styles.retryButton} onPress={handleAnalyze}>
                                <Text style={styles.retryText}>다시 시도</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {(result || initialResult) && !loading && (
                        <View style={styles.resultArea}>
                            <View style={styles.moodRow}>
                                <Text style={styles.moodEmoji}>{(result || initialResult).moodEmoji}</Text>
                                <View style={[
                                    styles.moodBadge,
                                    { backgroundColor: (moodColorMap[(result || initialResult).mood] || DrawerTheme.goldBright) + '22' }
                                ]}>
                                    <Text style={[
                                        styles.moodText,
                                        { color: moodColorMap[(result || initialResult).mood] || DrawerTheme.goldBright }
                                    ]}>
                                        {(result || initialResult).mood}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>📋 요약</Text>
                                <Text style={styles.sectionContent}>{(result || initialResult).summary}</Text>
                            </View>

                            {(result || initialResult).keywords?.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>🏷️ 키워드</Text>
                                    <View style={styles.keywordsRow}>
                                        {(result || initialResult).keywords.map((kw, i) => (
                                            <View key={i} style={styles.keywordChip}>
                                                <Text style={styles.keywordText}>#{kw}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {(result || initialResult).advice && (
                                <View style={[styles.section, styles.adviceSection]}>
                                    <Text style={styles.sectionLabel}>💡 다음 상담 제안</Text>
                                    <Text style={styles.adviceText}>{(result || initialResult).advice}</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
});

export const AIHistoryAnalysisPanel = React.memo(({ visits }) => {
    const { result, loading, error, analyze, reset } = useAnalyzeHistory();
    const [expanded, setExpanded] = useState(false);

    const validCount = visits?.filter(v => v.card_review?.trim()).length || 0;

    const handleAnalyze = async () => {
        setExpanded(true);
        await analyze(visits);
    };

    const handleReset = () => {
        reset();
        setExpanded(false);
    };

    if (validCount < 2) return null;

    return (
        <View style={styles.container}>
            {!expanded ? (
                <TouchableOpacity style={[styles.triggerButton, styles.historyTrigger]} onPress={handleAnalyze} activeOpacity={0.8}>
                    <Text style={styles.triggerIcon}>🔍</Text>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.triggerText}>전체 상담 AI 종합 분석</Text>
                            <View style={styles.proBadgeMin}>
                                <Text style={styles.proBadgeMinText}>PRO</Text>
                            </View>
                        </View>
                        <Text style={styles.triggerSubtext}>{validCount}개의 기록을 분석합니다</Text>
                    </View>
                    <Text style={styles.triggerArrow}>›</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.panel}>
                    <View style={styles.panelHeader}>
                        <Text style={styles.panelTitle}>🔍 종합 AI 분석</Text>
                        <TouchableOpacity onPress={handleReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {loading && (
                        <View style={styles.loadingArea}>
                            <ActivityIndicator size="small" color={DrawerTheme.goldBright} />
                            <Text style={styles.loadingText}>{validCount}개의 기록을 종합 분석 중...</Text>
                        </View>
                    )}

                    {error && !loading && (
                        <View style={styles.errorArea}>
                            <Text style={styles.errorText}>⚠️ {error}</Text>
                            <TouchableOpacity style={styles.retryButton} onPress={handleAnalyze}>
                                <Text style={styles.retryText}>다시 시도</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {result && !loading && (
                        <View style={styles.resultArea}>
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>📖 전체 흐름</Text>
                                <Text style={styles.sectionContent}>{result.overallSummary}</Text>
                            </View>

                            {result.patterns?.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>🔄 반복 주제</Text>
                                    {result.patterns.map((p, i) => (
                                        <View key={i} style={styles.patternItem}>
                                            <Text style={styles.patternDot}>•</Text>
                                            <Text style={styles.patternText}>{p}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {result.growthPoints && (
                                <View style={[styles.section, styles.growthSection]}>
                                    <Text style={styles.sectionLabel}>🌱 변화 & 성장</Text>
                                    <Text style={styles.growthText}>{result.growthPoints}</Text>
                                </View>
                            )}

                            {result.recommendation && (
                                <View style={[styles.section, styles.adviceSection]}>
                                    <Text style={styles.sectionLabel}>💡 향후 상담 방향</Text>
                                    <Text style={styles.adviceText}>{result.recommendation}</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: { marginVertical: 8 },
    proBadgeMin: {
        backgroundColor: DrawerTheme.goldBright,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    proBadgeMinText: {
        color: '#000',
        fontSize: 9,
        fontWeight: '900',
    },
    triggerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: DrawerTheme.goldBrass + '60',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
    },
    historyTrigger: {
        borderColor: DrawerTheme.navyLight + '60',
    },
    triggerIcon: { fontSize: 18 },
    triggerText: { flex: 1, color: DrawerTheme.goldBright, fontSize: 14, fontWeight: '600' },
    triggerSubtext: { color: TextColors.subTextMuted, fontSize: 11, marginTop: 2 },
    triggerArrow: { color: DrawerTheme.goldBright, fontSize: 20, opacity: 0.6 },
    panel: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        overflow: 'hidden',
    },
    panelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    panelTitle: {
        color: DrawerTheme.goldBright,
        fontSize: 14,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    closeText: { color: TextColors.subTextMuted, fontSize: 16 },
    loadingArea: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
    loadingText: { color: TextColors.subTextStrong, fontSize: 13 },
    errorArea: { padding: 16, gap: 10 },
    errorText: { color: '#FF6B6B', fontSize: 13 },
    retryButton: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    retryText: { color: DrawerTheme.goldBright, fontSize: 12 },
    resultArea: { padding: 14, gap: 12 },
    moodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    moodEmoji: { fontSize: 20 },
    moodBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    moodText: { fontSize: 12, fontWeight: '700' },
    section: { gap: 6 },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: TextColors.subTextStrong,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sectionContent: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 21 },
    keywordsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    keywordChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    keywordText: { color: TextColors.subTextStrong, fontSize: 12 },
    patternItem: { flexDirection: 'row', gap: 6 },
    patternDot: { color: DrawerTheme.goldBright, fontSize: 14 },
    patternText: { flex: 1, color: TextColors.subTextHigh, fontSize: 14, lineHeight: 20 },
    growthSection: {
        backgroundColor: 'rgba(76, 175, 80, 0.06)',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(76, 175, 80, 0.2)',
    },
    growthText: { color: TextColors.subTextHigh, fontSize: 14, lineHeight: 20 },
    adviceSection: {
        backgroundColor: 'rgba(255,193,7,0.06)',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,193,7,0.2)',
    },
    adviceText: { color: TextColors.subTextHigh, fontSize: 14, lineHeight: 20 },
});
