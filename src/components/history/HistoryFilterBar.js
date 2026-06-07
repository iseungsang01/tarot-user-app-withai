import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DrawerTheme } from '../../constants/DrawerTheme';

export const HistoryFilterBar = ({
    archiveMode,
    onSetArchiveMode,
    timeFilter,
    setTimeFilter,
    currentCoachStepKey,
    advanceCoachStep,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    selectionMode,
    selectedIds,
    setSelectionMode,
    setSelectedIds,
    onMultiDelete,
    onCaptureArchiveFrame,
    onCaptureTimeFilterFrame,
}) => {
    const archiveRef = useRef(null);
    const timeFilterRef = useRef(null);

    const captureRefFrame = (ref, capture) => {
        if (!ref?.current || !capture) return;
        ref.current.measureInWindow((x, y, width, height) => {
            if (width > 0 && height > 0) capture({ x, y, width, height });
        });
    };

    const getYearOptions = () => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => currentYear - i);
    };

    const pressArchiveMode = (mode) => {
        onSetArchiveMode(mode);
        if (currentCoachStepKey === 'home-archive-mode') {
            advanceCoachStep?.('home-archive-mode');
        }
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => captureRefFrame(archiveRef, onCaptureArchiveFrame));
        } else {
            captureRefFrame(archiveRef, onCaptureArchiveFrame);
        }
    };

    const pressTimeFilter = (filter) => {
        setTimeFilter(filter);
        if (currentCoachStepKey === 'home-time-filter') {
            advanceCoachStep?.('home-time-filter');
        }
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => captureRefFrame(timeFilterRef, onCaptureTimeFilterFrame));
        } else {
            captureRefFrame(timeFilterRef, onCaptureTimeFilterFrame);
        }
    };

    return (
        <View style={styles.wrap} pointerEvents="box-none">
            <View style={styles.controlShell} pointerEvents="box-none">
                <Text style={styles.railLabel}>BRASS DRAWER LABELS</Text>
                <View
                    ref={archiveRef}
                    style={styles.archiveRow}
                    onLayout={() => captureRefFrame(archiveRef, onCaptureArchiveFrame)}
                    pointerEvents="box-none"
                >
                    {[
                        { id: 'ON', label: 'ON', accessibilityLabel: '서버 방문 기록 보기' },
                        { id: 'OFF', label: 'OFF', accessibilityLabel: '개인 서랍 기록 보기' },
                        { id: 'ALL', label: 'ALL', accessibilityLabel: '전체 기록 보기' },
                    ].map((tab) => {
                        const active = archiveMode === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                testID={`history-archive-${tab.id}`}
                                accessibilityRole="button"
                                accessibilityLabel={tab.accessibilityLabel}
                                accessibilityState={{ selected: active }}
                                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                onPress={() => pressArchiveMode(tab.id)}
                                style={[styles.archiveButton, active && styles.archiveButtonActive]}
                                activeOpacity={0.86}
                            >
                                {active && (
                                    <LinearGradient
                                        pointerEvents="none"
                                        colors={['rgba(224,184,90,0.95)', 'rgba(184,135,53,0.88)', 'rgba(111,78,30,0.92)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                )}
                                <Text style={[styles.archiveLabel, active && styles.archiveLabelActive]}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <View
                ref={timeFilterRef}
                style={styles.filterRow}
                onLayout={() => captureRefFrame(timeFilterRef, onCaptureTimeFilterFrame)}
                pointerEvents="box-none"
            >
                {[
                    { id: 'ALL', label: '전체' },
                    { id: 'YEAR', label: '연도별' },
                    { id: 'MONTH', label: '월별' },
                ].map((tab) => {
                    const active = timeFilter === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            testID={`history-time-${tab.id}`}
                            accessibilityRole="button"
                            accessibilityLabel={`기록 ${tab.label} 필터`}
                            accessibilityState={{ selected: active }}
                            style={[styles.filterButton, active && styles.filterButtonActive]}
                            onPress={() => pressTimeFilter(tab.id)}
                            activeOpacity={0.86}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                            {active && (
                                <LinearGradient
                                    pointerEvents="none"
                                    colors={['rgba(224,184,90,0.92)', 'rgba(184,135,53,0.78)', 'rgba(111,78,30,0.78)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFill}
                                />
                            )}
                            <Text style={[styles.filterText, active && styles.filterTextActive]}>{tab.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {(timeFilter === 'YEAR' || timeFilter === 'MONTH') && (
                <View style={styles.yearSelector} pointerEvents="box-none">
                    {getYearOptions().map((year) => (
                        <TouchableOpacity
                            key={year}
                            testID={`history-year-${year}`}
                            accessibilityRole="button"
                            accessibilityLabel={`${year}년 기록 보기`}
                            accessibilityState={{ selected: selectedYear === year }}
                            style={[styles.yearButton, selectedYear === year && styles.yearButtonActive]}
                            onPress={() => setSelectedYear(year)}
                            activeOpacity={0.86}
                            hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                        >
                            <Text style={[styles.yearText, selectedYear === year && styles.yearTextActive]}>{year}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {timeFilter === 'MONTH' && (
                <View style={styles.monthSelector} pointerEvents="box-none">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <TouchableOpacity
                            key={month}
                            testID={`history-month-${month}`}
                            accessibilityRole="button"
                            accessibilityLabel={`${month}월 기록 보기`}
                            accessibilityState={{ selected: selectedMonth === month }}
                            style={[styles.monthButton, selectedMonth === month && styles.monthButtonActive]}
                            onPress={() => setSelectedMonth(month)}
                            activeOpacity={0.86}
                            hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                        >
                            <Text style={[styles.monthText, selectedMonth === month && styles.monthTextActive]}>{month}월</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {selectionMode ? (
                <View style={styles.selectionActions} pointerEvents="box-none">
                    <Text style={styles.selectedCount}>{selectedIds.size}개 선택됨</Text>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            testID="history-selection-cancel"
                            accessibilityRole="button"
                            accessibilityLabel="기록 선택 취소"
                            style={styles.cancelButton}
                            onPress={() => {
                                setSelectionMode(false);
                                setSelectedIds(new Set());
                            }}
                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        >
                            <Text style={styles.cancelButtonText}>취소</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            testID="history-selection-delete"
                            accessibilityRole="button"
                            accessibilityLabel="선택한 기록 삭제"
                            accessibilityState={{ disabled: selectedIds.size === 0 }}
                            style={[styles.deleteAllButton, selectedIds.size === 0 && styles.deleteAllButtonDisabled]}
                            onPress={onMultiDelete}
                            disabled={selectedIds.size === 0}
                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        >
                            <Text style={[styles.deleteAllText, selectedIds.size === 0 && styles.deleteAllTextDisabled]}>
                                선택 삭제
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={styles.hintContainer} pointerEvents="none">
                    <View style={styles.hintStar} />
                    <Text style={styles.hintText}>기록을 길게 누르면 여러 개를 선택할 수 있습니다.</Text>
                    <View style={styles.hintStar} />
                </View>
            )}
        </View>
    );
};

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const styles = StyleSheet.create({
    wrap: { width: '100%', alignItems: 'center', gap: 5, marginTop: 0, marginBottom: 6 },
    controlShell: { width: '100%', minHeight: 42, borderRadius: 5, paddingHorizontal: 5, paddingTop: 10, paddingBottom: 4, borderWidth: 1, borderTopWidth: 2, borderColor: 'rgba(184,135,53,0.64)', backgroundColor: 'rgba(31,18,12,0.64)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 3 },
    railLabel: { position: 'absolute', top: 2, left: 9, color: DrawerTheme.mutedIvory, fontSize: 7, fontWeight: '800', letterSpacing: 1, opacity: 0.68 },
    archiveRow: { width: '100%', flexDirection: 'row', gap: 4, overflow: 'visible' },
    archiveButton: { flex: 1, minHeight: 28, borderRadius: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(184,135,53,0.4)', backgroundColor: 'rgba(9,0,13,0.34)' },
    archiveButtonActive: { borderColor: 'rgba(244,232,208,0.72)', transform: [{ translateY: -2 }] },
    archiveLabel: { fontSize: 11, color: DrawerTheme.mutedIvory, fontWeight: '800', fontFamily: serif, letterSpacing: 0.8 },
    archiveLabelActive: { color: DrawerTheme.bgBlackCherry, textShadowColor: 'rgba(244,232,208,0.24)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
    filterRow: { width: '100%', minHeight: 34, flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: 'rgba(184,135,53,0.42)', borderRadius: 5, backgroundColor: 'rgba(31,18,12,0.5)', padding: 3, overflow: 'visible' },
    filterButton: { flex: 1, minHeight: 26, borderRadius: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(184,135,53,0.3)', backgroundColor: 'rgba(9,0,13,0.28)' },
    filterButtonActive: { borderColor: 'rgba(244,232,208,0.66)', transform: [{ translateY: -1 }] },
    filterText: { fontSize: 11, color: DrawerTheme.mutedIvory, fontWeight: '800', fontFamily: serif, letterSpacing: 0.4 },
    filterTextActive: { color: DrawerTheme.bgBlackCherry },
    yearSelector: { width: '100%', flexDirection: 'row', gap: 5 },
    yearButton: { flex: 1, paddingVertical: 5, borderRadius: 6, backgroundColor: 'rgba(9,0,13,0.55)', borderWidth: 1, borderColor: 'rgba(200,163,64,0.18)', alignItems: 'center' },
    yearButtonActive: { backgroundColor: 'rgba(50,29,18,0.86)', borderColor: DrawerTheme.antiqueGold },
    yearText: { fontSize: 10, color: DrawerTheme.mutedPurple, fontWeight: '700' },
    yearTextActive: { color: DrawerTheme.brightGold },
    monthSelector: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    monthButton: { width: '15.6%', paddingVertical: 5, borderRadius: 6, backgroundColor: 'rgba(9,0,13,0.55)', borderWidth: 1, borderColor: 'rgba(200,163,64,0.18)', alignItems: 'center' },
    monthButtonActive: { backgroundColor: 'rgba(50,29,18,0.86)', borderColor: DrawerTheme.antiqueGold },
    monthText: { fontSize: 9, color: DrawerTheme.mutedPurple, fontWeight: '700' },
    monthTextActive: { color: DrawerTheme.brightGold },
    selectionActions: { width: '100%', backgroundColor: 'rgba(9,0,13,0.78)', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: 'rgba(224,184,90,0.55)' },
    selectedCount: { fontSize: 13, color: DrawerTheme.brightGold, fontWeight: '700', marginBottom: 9, textAlign: 'center', fontFamily: serif },
    actionButtons: { flexDirection: 'row', gap: 9 },
    cancelButton: { flex: 1, paddingVertical: 11, borderRadius: 8, backgroundColor: 'rgba(244,232,208,0.08)', borderWidth: 1, borderColor: 'rgba(244,232,208,0.14)', alignItems: 'center' },
    cancelButtonText: { fontSize: 13, color: DrawerTheme.mutedIvory, fontWeight: '700' },
    deleteAllButton: { flex: 1, paddingVertical: 11, borderRadius: 8, backgroundColor: 'rgba(74,15,43,0.62)', borderWidth: 1, borderColor: 'rgba(224,184,90,0.38)', alignItems: 'center' },
    deleteAllButtonDisabled: { opacity: 0.55 },
    deleteAllText: { fontSize: 13, color: DrawerTheme.brightGold, fontWeight: '800' },
    deleteAllTextDisabled: { opacity: 0.35 },
    hintContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 4 },
    hintStar: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(224,184,90,0.48)' },
    hintText: { flex: 1, fontSize: 11, lineHeight: 15, color: DrawerTheme.mutedIvory, textAlign: 'center', opacity: 0.72 },
});
