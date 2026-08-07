import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DrawerTheme } from '../../constants/DrawerTheme';
import {
    RECORD_TYPE_LABELS,
    VIEW_MODE_LABELS,
    SORT_MODE_LABELS,
    RECORD_STATUS_LABELS,
} from '../../constants/historyFilters';

const RECORD_TYPE_OPTIONS = ['all', 'visit', 'personal'];
const VIEW_MODE_OPTIONS = ['all', 'year', 'month'];
const SORT_MODE_OPTIONS = ['latest', 'oldest'];
const RECORD_STATUS_OPTIONS = ['all', 'hasRecord', 'empty'];

const FILTER_SHEETS = {
    viewMode: {
        title: '보기 방식',
        options: VIEW_MODE_OPTIONS,
        labels: VIEW_MODE_LABELS,
    },
    sortMode: {
        title: '정렬',
        options: SORT_MODE_OPTIONS,
        labels: SORT_MODE_LABELS,
    },
    recordStatus: {
        title: '기록 상태',
        options: RECORD_STATUS_OPTIONS,
        labels: RECORD_STATUS_LABELS,
    },
};

export const HistoryFilterBar = ({
    recordType,
    setRecordType,
    viewMode,
    setViewMode,
    sortMode,
    setSortMode,
    recordStatus,
    setRecordStatus,
    selectionMode,
    selectedIds,
    setSelectionMode,
    setSelectedIds,
    onMultiDelete,
}) => {
    const [activeSheet, setActiveSheet] = useState(null);
    const sheetConfig = activeSheet ? FILTER_SHEETS[activeSheet] : null;

    const selectedValue = useMemo(() => ({
        viewMode,
        sortMode,
        recordStatus,
    }), [viewMode, sortMode, recordStatus]);

    const setSheetValue = (nextValue) => {
        if (activeSheet === 'viewMode') setViewMode(nextValue);
        if (activeSheet === 'sortMode') setSortMode(nextValue);
        if (activeSheet === 'recordStatus') setRecordStatus(nextValue);
        setActiveSheet(null);
    };

    return (
        <View style={styles.wrap} pointerEvents="box-none">
            <LinearGradient
                colors={['rgba(18,0,8,0.88)', 'rgba(31,18,12,0.76)', 'rgba(18,0,8,0.92)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.filterShell}
                pointerEvents="box-none"
            >
                <View style={styles.primaryTabs} pointerEvents="box-none">
                    {RECORD_TYPE_OPTIONS.map((type) => {
                        const active = recordType === type;
                        return (
                            <TouchableOpacity
                                key={type}
                                testID={`history-record-type-${type}`}
                                accessibilityRole="tab"
                                accessibilityLabel={`${RECORD_TYPE_LABELS[type]} 보기`}
                                accessibilityState={{ selected: active }}
                                hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
                                onPress={() => setRecordType(type)}
                                style={[styles.primaryTab, active && styles.primaryTabActive]}
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
                                <Text style={[styles.primaryTabText, active && styles.primaryTabTextActive]}>
                                    {RECORD_TYPE_LABELS[type]}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.chipRow} pointerEvents="box-none">
                    <FilterChip label={`${VIEW_MODE_LABELS[viewMode]} ▼`} onPress={() => setActiveSheet('viewMode')} />
                    <FilterChip label={`${SORT_MODE_LABELS[sortMode]} ▼`} onPress={() => setActiveSheet('sortMode')} />
                    <FilterChip
                        label={`${recordStatus === 'all' ? '기록 상태' : RECORD_STATUS_LABELS[recordStatus]} ▼`}
                        active={recordStatus !== 'all'}
                        onPress={() => setActiveSheet('recordStatus')}
                    />
                </View>

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
                        <Text style={styles.hintText}>길게 누르면 여러 개를 한 번에 정리할 수 있어요.</Text>
                        <View style={styles.hintStar} />
                    </View>
                )}
            </LinearGradient>

            <Modal
                visible={!!sheetConfig}
                transparent
                animationType="fade"
                onRequestClose={() => setActiveSheet(null)}
            >
                <Pressable style={styles.sheetBackdrop} onPress={() => setActiveSheet(null)}>
                    <Pressable style={styles.sheetCard}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>{sheetConfig?.title}</Text>
                        {sheetConfig?.options.map((option) => {
                            const active = selectedValue[activeSheet] === option;
                            return (
                                <TouchableOpacity
                                    key={option}
                                    testID={`history-${activeSheet}-${option}`}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                    style={[styles.sheetOption, active && styles.sheetOptionActive]}
                                    onPress={() => setSheetValue(option)}
                                    activeOpacity={0.86}
                                >
                                    <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>
                                        {sheetConfig.labels[option]}
                                    </Text>
                                    {active && <Text style={styles.sheetCheck}>✓</Text>}
                                </TouchableOpacity>
                            );
                        })}
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
};

const FilterChip = ({ label, onPress, active }) => (
    <TouchableOpacity
        accessibilityRole="button"
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={onPress}
        activeOpacity={0.84}
        hitSlop={{ top: 7, bottom: 7, left: 3, right: 3 }}
    >
        <Text numberOfLines={1} style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
);

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const styles = StyleSheet.create({
    wrap: { width: '100%', alignItems: 'center', marginTop: 0, marginBottom: 5 },
    filterShell: {
        width: '100%',
        borderRadius: 13,
        paddingHorizontal: 8,
        paddingTop: 7,
        paddingBottom: 6,
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.34)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 10,
        elevation: 4,
        overflow: 'hidden',
    },
    primaryTabs: { width: '100%', flexDirection: 'row', gap: 5 },
    primaryTab: {
        flex: 1,
        minHeight: 32,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.26)',
        backgroundColor: 'rgba(9,0,13,0.44)',
    },
    primaryTabActive: {
        borderColor: 'rgba(244,232,208,0.84)',
        shadowColor: DrawerTheme.brassHighlight,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
        elevation: 3,
    },
    primaryTabText: {
        fontSize: 12,
        color: DrawerTheme.ivory,
        fontWeight: '900',
        fontFamily: serif,
        letterSpacing: 0.2,
    },
    primaryTabTextActive: { color: DrawerTheme.bgBlackCherry },
    chipRow: { width: '100%', flexDirection: 'row', gap: 5, marginTop: 6 },
    filterChip: {
        flex: 1,
        minHeight: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.22)',
        backgroundColor: 'rgba(244,232,208,0.055)',
    },
    filterChipActive: {
        borderColor: 'rgba(224,184,90,0.62)',
        backgroundColor: 'rgba(184,135,53,0.2)',
    },
    filterChipText: {
        fontSize: 10,
        color: DrawerTheme.mutedIvory,
        fontWeight: '800',
        letterSpacing: 0.1,
    },
    filterChipTextActive: { color: DrawerTheme.brightGold },
    hintContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 6 },
    hintStar: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: 'rgba(224,184,90,0.44)' },
    hintText: { flex: 1, fontSize: 9.5, lineHeight: 12, color: DrawerTheme.mutedIvory, textAlign: 'center', opacity: 0.76 },
    selectionActions: {
        marginTop: 6,
        borderRadius: 10,
        padding: 8,
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.28)',
        backgroundColor: 'rgba(18,0,8,0.62)',
    },
    selectedCount: { fontSize: 12, color: DrawerTheme.brightGold, fontWeight: '900', fontFamily: serif, marginBottom: 7 },
    actionButtons: { flexDirection: 'row', gap: 7 },
    cancelButton: { flex: 1, minHeight: 34, borderRadius: 9, backgroundColor: 'rgba(244,232,208,0.08)', borderWidth: 1, borderColor: 'rgba(244,232,208,0.16)', alignItems: 'center', justifyContent: 'center' },
    cancelButtonText: { fontSize: 12, color: DrawerTheme.ivory, fontWeight: '800' },
    deleteAllButton: { flex: 1, minHeight: 34, borderRadius: 9, backgroundColor: 'rgba(74,15,43,0.78)', borderWidth: 1, borderColor: 'rgba(224,184,90,0.42)', alignItems: 'center', justifyContent: 'center' },
    deleteAllButtonDisabled: { opacity: 0.48 },
    deleteAllText: { fontSize: 12, color: DrawerTheme.brightGold, fontWeight: '900' },
    deleteAllTextDisabled: { opacity: 0.38 },
    sheetBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.58)',
    },
    sheetCard: {
        margin: 14,
        marginBottom: 24,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: DrawerTheme.archiveBorderStrong,
        backgroundColor: DrawerTheme.bgDeepPurple,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 8,
    },
    sheetHandle: {
        alignSelf: 'center',
        width: 38,
        height: 4,
        borderRadius: 2,
        marginBottom: 12,
        backgroundColor: 'rgba(224,184,90,0.36)',
    },
    sheetTitle: { color: DrawerTheme.brightGold, fontSize: 15, fontWeight: '900', fontFamily: serif, marginBottom: 9 },
    sheetOption: {
        minHeight: 44,
        borderRadius: 12,
        paddingHorizontal: 13,
        marginTop: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.18)',
        backgroundColor: 'rgba(9,0,13,0.38)',
    },
    sheetOptionActive: {
        borderColor: DrawerTheme.brassHighlight,
        backgroundColor: 'rgba(184,135,53,0.18)',
    },
    sheetOptionText: { color: DrawerTheme.ivory, fontSize: 14, fontWeight: '800' },
    sheetOptionTextActive: { color: DrawerTheme.brightGold },
    sheetCheck: { color: DrawerTheme.brightGold, fontSize: 15, fontWeight: '900' },
});
