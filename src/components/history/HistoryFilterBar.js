import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DrawerTheme } from '../../constants/DrawerTheme';

const archiveTabs = [
    { id: 'ON', label: '방문', caption: '방문 기록', accessibilityLabel: '서버 방문 기록 보기' },
    { id: 'OFF', label: '개인', caption: '개인 서랍', accessibilityLabel: '개인 서랍 기록 보기' },
    { id: 'ALL', label: '전체', caption: '모든 서랍', accessibilityLabel: '전체 기록 보기' },
];

const timeTabs = [
    { id: 'ALL', label: '전체', caption: '모든 기록' },
    { id: 'YEAR', label: '연도별', caption: '연도 라벨' },
    { id: 'MONTH', label: '월별', caption: '월 라벨' },
];

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
            <LinearGradient
                colors={[DrawerTheme.archivePanel, 'rgba(31,18,12,0.82)', DrawerTheme.archivePanelDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.controlShell}
                pointerEvents="box-none"
            >
                <View style={styles.labelRivetLeft} />
                <View style={styles.labelRivetRight} />
                <Text style={styles.railLabel}>서랍 분류 명패</Text>
                <View
                    ref={archiveRef}
                    style={styles.archiveRow}
                    onLayout={() => captureRefFrame(archiveRef, onCaptureArchiveFrame)}
                    pointerEvents="box-none"
                >
                    {archiveTabs.map((tab) => {
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
                                        colors={[DrawerTheme.brassHighlight, DrawerTheme.brass, DrawerTheme.darkGold]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                )}
                                <Text style={[styles.archiveLabel, active && styles.archiveLabelActive]}>{tab.label}</Text>
                                <Text style={[styles.archiveCaption, active && styles.archiveCaptionActive]}>{tab.caption}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </LinearGradient>

            <View
                ref={timeFilterRef}
                style={styles.filterRow}
                onLayout={() => captureRefFrame(timeFilterRef, onCaptureTimeFilterFrame)}
                pointerEvents="box-none"
            >
                {timeTabs.map((tab) => {
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
                                    colors={['rgba(224,184,90,0.95)', 'rgba(184,135,53,0.78)', 'rgba(111,78,30,0.82)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFill}
                                />
                            )}
                            <Text style={[styles.filterText, active && styles.filterTextActive]}>{tab.label}</Text>
                            <Text style={[styles.filterCaption, active && styles.filterCaptionActive]}>{tab.caption}</Text>
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
                <LinearGradient
                    colors={['rgba(18,0,8,0.94)', 'rgba(74,15,43,0.72)', 'rgba(31,18,12,0.9)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.selectionActions}
                    pointerEvents="box-none"
                >
                    <View style={styles.selectionHeaderRow}>
                        <Text style={styles.selectedCount}>{selectedIds.size}개 선택됨</Text>
                        <Text style={styles.selectionHint}>정리할 서랍을 확인하세요</Text>
                    </View>
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
                </LinearGradient>
            ) : (
                <View style={styles.hintContainer} pointerEvents="none">
                    <View style={styles.hintStar} />
                    <Text style={styles.hintText}>서랍을 길게 누르면 여러 기록을 한 번에 정리할 수 있어요.</Text>
                    <View style={styles.hintStar} />
                </View>
            )}
        </View>
    );
};

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const styles = StyleSheet.create({
    wrap: { width: '100%', alignItems: 'center', gap: 7, marginTop: 0, marginBottom: 8 },
    controlShell: {
        width: '100%',
        minHeight: 72,
        borderRadius: 10,
        paddingHorizontal: 9,
        paddingTop: 18,
        paddingBottom: 8,
        borderWidth: 1,
        borderTopWidth: 2,
        borderColor: DrawerTheme.archiveBorderStrong,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 4,
        overflow: 'hidden',
    },
    labelRivetLeft: { position: 'absolute', top: 8, left: 10, width: 5, height: 5, borderRadius: 3, backgroundColor: DrawerTheme.brassHighlight, opacity: 0.74 },
    labelRivetRight: { position: 'absolute', top: 8, right: 10, width: 5, height: 5, borderRadius: 3, backgroundColor: DrawerTheme.brassHighlight, opacity: 0.74 },
    railLabel: { position: 'absolute', top: 5, alignSelf: 'center', color: DrawerTheme.mutedIvory, fontSize: 9, fontWeight: '800', letterSpacing: 1.6, opacity: 0.78 },
    archiveRow: { width: '100%', flexDirection: 'row', gap: 7, overflow: 'visible' },
    archiveButton: { flex: 1, minHeight: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: DrawerTheme.archiveBorder, backgroundColor: 'rgba(9,0,13,0.42)' },
    archiveButtonActive: { borderColor: 'rgba(244,232,208,0.82)', transform: [{ translateY: -1 }] },
    archiveLabel: { fontSize: 13, color: DrawerTheme.ivory, fontWeight: '900', fontFamily: serif, letterSpacing: 0.6 },
    archiveLabelActive: { color: DrawerTheme.bgBlackCherry, textShadowColor: 'rgba(244,232,208,0.24)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
    archiveCaption: { marginTop: 2, fontSize: 9, color: DrawerTheme.mutedIvory, fontWeight: '700', letterSpacing: 0.2, opacity: 0.76 },
    archiveCaptionActive: { color: 'rgba(18,0,8,0.78)', opacity: 0.9 },
    filterRow: { width: '100%', minHeight: 52, flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: DrawerTheme.archiveBorder, borderRadius: 10, backgroundColor: DrawerTheme.archivePanel, padding: 5, overflow: 'visible' },
    filterButton: { flex: 1, minHeight: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(184,135,53,0.3)', backgroundColor: 'rgba(9,0,13,0.32)' },
    filterButtonActive: { borderColor: 'rgba(244,232,208,0.68)' },
    filterText: { fontSize: 12, color: DrawerTheme.ivory, fontWeight: '900', fontFamily: serif, letterSpacing: 0.4 },
    filterTextActive: { color: DrawerTheme.bgBlackCherry },
    filterCaption: { marginTop: 1, fontSize: 8, color: DrawerTheme.mutedIvory, fontWeight: '700', opacity: 0.68 },
    filterCaptionActive: { color: 'rgba(18,0,8,0.72)', opacity: 0.92 },
    yearSelector: { width: '100%', flexDirection: 'row', gap: 5, paddingHorizontal: 1 },
    yearButton: { flex: 1, minHeight: 42, borderRadius: 8, backgroundColor: 'rgba(9,0,13,0.58)', borderWidth: 1, borderColor: 'rgba(200,163,64,0.22)', alignItems: 'center', justifyContent: 'center' },
    yearButtonActive: { backgroundColor: 'rgba(50,29,18,0.92)', borderColor: DrawerTheme.brassHighlight },
    yearText: { fontSize: 11, color: DrawerTheme.mutedIvory, fontWeight: '800' },
    yearTextActive: { color: DrawerTheme.brightGold },
    monthSelector: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingHorizontal: 1 },
    monthButton: { width: '15.6%', minHeight: 38, borderRadius: 8, backgroundColor: 'rgba(9,0,13,0.58)', borderWidth: 1, borderColor: 'rgba(200,163,64,0.22)', alignItems: 'center', justifyContent: 'center' },
    monthButtonActive: { backgroundColor: 'rgba(50,29,18,0.92)', borderColor: DrawerTheme.brassHighlight },
    monthText: { fontSize: 10, color: DrawerTheme.mutedIvory, fontWeight: '800' },
    monthTextActive: { color: DrawerTheme.brightGold },
    selectionActions: { width: '100%', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: DrawerTheme.archiveBorderStrong, shadowColor: DrawerTheme.brassHighlight, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 4 },
    selectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 },
    selectedCount: { fontSize: 15, color: DrawerTheme.brightGold, fontWeight: '900', fontFamily: serif },
    selectionHint: { flex: 1, fontSize: 10, color: DrawerTheme.mutedIvory, textAlign: 'right', opacity: 0.76 },
    actionButtons: { flexDirection: 'row', gap: 9 },
    cancelButton: { flex: 1, minHeight: 46, borderRadius: 10, backgroundColor: 'rgba(244,232,208,0.08)', borderWidth: 1, borderColor: 'rgba(244,232,208,0.18)', alignItems: 'center', justifyContent: 'center' },
    cancelButtonText: { fontSize: 14, color: DrawerTheme.ivory, fontWeight: '800' },
    deleteAllButton: { flex: 1, minHeight: 46, borderRadius: 10, backgroundColor: 'rgba(74,15,43,0.78)', borderWidth: 1, borderColor: 'rgba(224,184,90,0.46)', alignItems: 'center', justifyContent: 'center' },
    deleteAllButtonDisabled: { opacity: 0.48 },
    deleteAllText: { fontSize: 14, color: DrawerTheme.brightGold, fontWeight: '900' },
    deleteAllTextDisabled: { opacity: 0.38 },
    hintContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 5 },
    hintStar: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(224,184,90,0.48)' },
    hintText: { flex: 1, fontSize: 11, lineHeight: 15, color: DrawerTheme.mutedIvory, textAlign: 'center', opacity: 0.76 },
});
