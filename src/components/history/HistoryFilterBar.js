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
    onCaptureTimeFilterFrame
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

    return (
        <View style={styles.wrap}>
            <View style={styles.controlShell}>
                <View
                    ref={archiveRef}
                    style={styles.archiveRow}
                    onLayout={() => captureRefFrame(archiveRef, onCaptureArchiveFrame)}
                >
                    {[
                        { id: 'ON', label: 'ON' },
                        { id: 'OFF', label: 'OFF' },
                        { id: 'ALL', label: 'ALL' }
                    ].map((tab) => {
                        const active = archiveMode === tab.id;

                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => {
                                    onSetArchiveMode(tab.id);
                                    if (currentCoachStepKey === 'home-archive-mode') {
                                        advanceCoachStep?.('home-archive-mode');
                                    }
                                    captureRefFrame(archiveRef, onCaptureArchiveFrame);
                                }}
                                style={[styles.archiveButton, active && styles.archiveButtonActive]}
                                activeOpacity={0.86}
                            >
                                {active && (
                                    <LinearGradient
                                        colors={['rgba(74,15,43,0.96)', 'rgba(42,6,44,0.98)', 'rgba(111,78,30,0.58)']}
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
            >
                {[
                    { id: 'ALL', label: '전체' },
                    { id: 'YEAR', label: '연도별' },
                    { id: 'MONTH', label: '월별' }
                ].map((tab) => {
                    const active = timeFilter === tab.id;

                    return (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.filterButton, active && styles.filterButtonActive]}
                            onPress={() => {
                                setTimeFilter(tab.id);
                                if (currentCoachStepKey === 'home-time-filter') {
                                    advanceCoachStep?.('home-time-filter');
                                }
                                captureRefFrame(timeFilterRef, onCaptureTimeFilterFrame);
                            }}
                            activeOpacity={0.86}
                        >
                            {active && <View style={styles.filterActiveGlow} />}
                            <Text style={[styles.filterText, active && styles.filterTextActive]}>{tab.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {(timeFilter === 'YEAR' || timeFilter === 'MONTH') && (
                <View style={styles.yearSelector}>
                    {getYearOptions().map(year => (
                        <TouchableOpacity
                            key={year}
                            style={[styles.yearButton, selectedYear === year && styles.yearButtonActive]}
                            onPress={() => setSelectedYear(year)}
                            activeOpacity={0.86}
                        >
                            <Text style={[styles.yearText, selectedYear === year && styles.yearTextActive]}>{year}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {timeFilter === 'MONTH' && (
                <View style={styles.monthSelector}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <TouchableOpacity
                            key={month}
                            style={[styles.monthButton, selectedMonth === month && styles.monthButtonActive]}
                            onPress={() => setSelectedMonth(month)}
                            activeOpacity={0.86}
                        >
                            <Text style={[styles.monthText, selectedMonth === month && styles.monthTextActive]}>{month}월</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {selectionMode ? (
                <View style={styles.selectionActions}>
                    <Text style={styles.selectedCount}>{selectedIds.size}개 선택됨</Text>

                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                                setSelectionMode(false);
                                setSelectedIds(new Set());
                            }}
                        >
                            <Text style={styles.cancelButtonText}>취소</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.deleteAllButton}
                            onPress={onMultiDelete}
                            disabled={selectedIds.size === 0}
                        >
                            <Text style={[styles.deleteAllText, selectedIds.size === 0 && styles.deleteAllTextDisabled]}>
                                선택 삭제
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={styles.hintContainer}>
                    <View style={styles.hintStar} />
                    <Text style={styles.hintText}>황금 손잡이를 길게 누르면 여러 장의 기록을 꺼낼 수 있습니다.</Text>
                    <View style={styles.hintStar} />
                </View>
            )}
        </View>
    );
};

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const styles = StyleSheet.create({
    wrap: {
        width: '100%',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
        marginBottom: 8,
    },
    controlShell: {
        width: '100%',
        minHeight: 66,
        borderRadius: 8,
        padding: 5,
        borderWidth: 1,
        borderColor: 'rgba(184,135,53,0.64)',
        backgroundColor: 'rgba(9,0,13,0.62)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
        elevation: 3,
    },
    archiveRow: {
        width: '100%',
        flexDirection: 'row',
        borderRadius: 7,
        backgroundColor: 'rgba(9,0,13,0.22)',
        overflow: 'hidden',
    },
    archiveButton: {
        flex: 1,
        minHeight: 54,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    archiveButtonActive: {
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.82)',
    },
    archiveLabel: {
        fontSize: 17,
        color: DrawerTheme.mutedIvory,
        fontWeight: '700',
        fontFamily: serif,
        letterSpacing: 0.8,
    },
    archiveLabelActive: {
        color: DrawerTheme.brightGold,
        textShadowColor: 'rgba(224,184,90,0.22)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 4,
    },
    filterRow: {
        width: '100%',
        minHeight: 60,
        flexDirection: 'row',
        borderWidth: 1.5,
        borderColor: 'rgba(184,135,53,0.7)',
        borderRadius: 8,
        backgroundColor: 'rgba(9,0,13,0.72)',
        padding: 6,
        overflow: 'hidden',
    },
    filterButton: {
        flex: 1,
        minHeight: 46,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    filterButtonActive: {
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.74)',
        backgroundColor: 'rgba(74,15,43,0.72)',
    },
    filterActiveGlow: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(224,184,90,0.08)',
    },
    filterText: {
        fontSize: 14,
        color: DrawerTheme.mutedIvory,
        fontWeight: '700',
        fontFamily: serif,
        letterSpacing: 0.4,
    },
    filterTextActive: {
        color: DrawerTheme.brightGold,
    },
    yearSelector: {
        width: '100%',
        flexDirection: 'row',
        gap: 7,
    },
    yearButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(9,0,13,0.55)',
        borderWidth: 1,
        borderColor: 'rgba(200,163,64,0.18)',
        alignItems: 'center',
    },
    yearButtonActive: {
        backgroundColor: 'rgba(50,29,18,0.86)',
        borderColor: DrawerTheme.antiqueGold,
    },
    yearText: {
        fontSize: 11,
        color: DrawerTheme.mutedPurple,
        fontWeight: '700',
    },
    yearTextActive: {
        color: DrawerTheme.brightGold,
    },
    monthSelector: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 7,
    },
    monthButton: {
        width: '15.2%',
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(9,0,13,0.55)',
        borderWidth: 1,
        borderColor: 'rgba(200,163,64,0.18)',
        alignItems: 'center',
    },
    monthButtonActive: {
        backgroundColor: 'rgba(50,29,18,0.86)',
        borderColor: DrawerTheme.antiqueGold,
    },
    monthText: {
        fontSize: 10,
        color: DrawerTheme.mutedPurple,
        fontWeight: '700',
    },
    monthTextActive: {
        color: DrawerTheme.brightGold,
    },
    selectionActions: {
        width: '100%',
        backgroundColor: 'rgba(9,0,13,0.78)',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.55)',
    },
    selectedCount: {
        fontSize: 13,
        color: DrawerTheme.brightGold,
        fontWeight: '700',
        marginBottom: 9,
        textAlign: 'center',
        fontFamily: serif,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 9,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 11,
        borderRadius: 8,
        backgroundColor: 'rgba(244,232,208,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(244,232,208,0.14)',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 13,
        color: DrawerTheme.mutedIvory,
        fontWeight: '700',
    },
    deleteAllButton: {
        flex: 1,
        paddingVertical: 11,
        borderRadius: 8,
        backgroundColor: 'rgba(74,15,43,0.62)',
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.38)',
        alignItems: 'center',
    },
    deleteAllText: {
        fontSize: 13,
        color: DrawerTheme.brightGold,
        fontWeight: '800',
    },
    deleteAllTextDisabled: {
        color: 'rgba(205,187,150,0.34)',
    },
    hintContainer: {
        width: '100%',
        minHeight: 38,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(9,0,13,0.58)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(184,135,53,0.36)',
    },
    hintText: {
        flex: 1,
        fontSize: 12,
        color: DrawerTheme.mutedGold,
        textAlign: 'center',
        lineHeight: 16,
        paddingHorizontal: 8,
    },
    hintStar: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.44)',
        backgroundColor: 'rgba(224,184,90,0.14)',
    },
});
