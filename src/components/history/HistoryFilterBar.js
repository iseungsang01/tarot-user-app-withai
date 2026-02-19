import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerTheme } from '../../constants/DrawerTheme';

export const HistoryFilterBar = ({
    timeFilter,
    setTimeFilter,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    selectionMode,
    selectedIds,
    setSelectionMode,
    setSelectedIds,
    onMultiDelete
}) => {
    const getYearOptions = () => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => currentYear - i);
    };

    return (
        <View style={{ width: '100%', alignItems: 'center' }}>
            <View style={styles.filterSection}>
                <View style={styles.filterRow}>
                    {['ALL', 'YEAR', 'MONTH'].map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={[styles.filterButton, timeFilter === type && styles.filterButtonActive]}
                            onPress={() => setTimeFilter(type)}
                        >
                            <Text style={[styles.filterText, timeFilter === type && styles.filterTextActive]}>
                                {type === 'ALL' ? '전체' : type === 'YEAR' ? '연도별' : '월별'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {(timeFilter === 'YEAR' || timeFilter === 'MONTH') && (
                    <View style={styles.yearSelector}>
                        {getYearOptions().map(year => (
                            <TouchableOpacity
                                key={year}
                                style={[styles.yearButton, selectedYear === year && styles.yearButtonActive]}
                                onPress={() => setSelectedYear(year)}
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
                            >
                                <Text style={[styles.monthText, selectedMonth === month && styles.monthTextActive]}>{month}월</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            {/* Selection Control or Hint */}
            {selectionMode ? (
                <View style={styles.selectionControl}>
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
                                    🗑️ 선택 삭제
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            ) : (
                <View style={styles.hintContainer}>
                    <Text style={styles.hintText}>💡 서랍을 길게 누르면 다중 선택 모드로 진입합니다</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    filterSection: { width: '92%', marginTop: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
    filterRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
    filterButton: { flex: 1, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
    filterButtonActive: { backgroundColor: DrawerTheme.goldBrass, borderColor: DrawerTheme.goldBright },
    filterText: { fontSize: 10, color: '#AAA', fontWeight: 'bold' },
    filterTextActive: { color: '#1A0F0A' },
    yearSelector: { flexDirection: 'row', gap: 6, marginBottom: 6 },
    yearButton: { flex: 1, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
    yearButtonActive: { backgroundColor: DrawerTheme.woodMid, borderColor: DrawerTheme.goldBrass },
    yearText: { fontSize: 10, color: '#999', fontWeight: 'bold' },
    yearTextActive: { color: DrawerTheme.goldBright },
    monthSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    monthButton: { width: '15%', paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
    monthButtonActive: { backgroundColor: DrawerTheme.woodMid, borderColor: DrawerTheme.goldBrass },
    monthText: { fontSize: 9, color: '#999', fontWeight: 'bold' },
    monthTextActive: { color: DrawerTheme.goldBright },

    selectionControl: { width: '92%', marginTop: 8 },
    selectionActions: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1.5,
        borderColor: DrawerTheme.goldBrass
    },
    selectedCount: {
        fontSize: 13,
        color: DrawerTheme.goldBrass,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center'
    },
    actionButtons: { flexDirection: 'row', gap: 8 },
    cancelButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center'
    },
    cancelButtonText: { fontSize: 13, color: '#AAA', fontWeight: 'bold' },
    deleteAllButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255,107,107,0.2)',
        borderWidth: 1,
        borderColor: 'rgba(255,107,107,0.4)',
        alignItems: 'center'
    },
    deleteAllText: { fontSize: 13, color: '#ff6b6b', fontWeight: 'bold' },
    deleteAllTextDisabled: { color: '#555' },
    hintContainer: {
        width: '92%',
        marginTop: 8,
        padding: 8,
        backgroundColor: 'rgba(212,175,55,0.1)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.2)'
    },
    hintText: {
        fontSize: 11,
        color: DrawerTheme.woodLight,
        textAlign: 'center',
        lineHeight: 16
    },
});
