import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Components
import {
    GradientBackground,
    LoadingSpinner,
    DrawerChest,
    DrawerUnit,
    TarotCardModal,
    HistoryHeader,
    HistoryFilterBar,
    AIHistoryAnalysisPanel
} from '../../components';
import { DrawerTheme } from '../../constants/DrawerTheme';

// Hook
import { useHistoryLogic } from '../../hooks/useHistoryLogic';

const HistoryScreen = ({ onCaptureCoachFrame, currentCoachStepKey, advanceCoachStep }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const {
        state,
        actions,
    } = useHistoryLogic(navigation);

    const {
        customer,
        isVisitsLoading,
        refreshing,
        stats,
        couponCount,
        visits,
        archiveMode,
        timeFilter,
        selectedYear,
        selectedMonth,
        selectionMode,
        selectedIds,
        isModalVisible,
        selectedItem,
        displayData,
    } = state;

    const {
        setArchiveMode,
        setTimeFilter,
        setSelectedYear,
        setSelectedMonth,
        setSelectionMode,
        setSelectedIds,
        setIsModalVisible,
        setSelectedItem,
        refreshAllData,
        handleRefresh,
        toggleSelection,
        handleLongPress,
        handleDeleteVisit,
        handleMultiDelete
    } = actions;

    useFocusEffect(
        useCallback(() => {
            if (customer) {
                refreshAllData();
            }
        }, [customer, refreshAllData])
    );

    const renderHeader = () => (
        <>
            <HistoryHeader
                stats={stats}
                couponCount={couponCount}
                onNavigateCoupon={() => navigation.navigate('Coupon')}
                onNavigateStamp={() => navigation.navigate('Stamp')}
                onCoachAdvanceCoupon={() => advanceCoachStep?.('home-coupon')}
                onCoachAdvanceStamp={() => advanceCoachStep?.('home-stamp')}
                onCaptureStampFrame={(frame) => onCaptureCoachFrame?.('home-stamp', frame)}
                onCaptureCouponFrame={(frame) => onCaptureCoachFrame?.('home-coupon', frame)}
            />
            <HistoryFilterBar
                archiveMode={archiveMode}
                onSetArchiveMode={setArchiveMode}
                timeFilter={timeFilter}
                setTimeFilter={setTimeFilter}
                currentCoachStepKey={currentCoachStepKey}
                advanceCoachStep={advanceCoachStep}
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                setSelectionMode={setSelectionMode}
                setSelectedIds={setSelectedIds}
                onMultiDelete={handleMultiDelete}
                onCaptureArchiveFrame={(frame) => onCaptureCoachFrame?.('home-archive-mode', frame)}
                onCaptureTimeFilterFrame={(frame) => onCaptureCoachFrame?.('home-time-filter', frame)}
            />
        </>
    );

    const renderDrawerChest = () => {
        return (
            <DrawerChest isManualMode={archiveMode === 'OFF'} selectionMode={selectionMode}>
                <AIHistoryAnalysisPanel visits={visits} />

                {archiveMode === 'OFF' && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={[styles.manualAddDrawer, { backgroundColor: DrawerTheme.navyDark }]}
                        onPress={() => navigation.navigate('VisitDetail', { mode: 'manual', is_manual: true })}
                    >
                        <Text style={[styles.manualAddText, { color: DrawerTheme.goldBrass }]}>+ 개인 메모 서랍 추가</Text>
                    </TouchableOpacity>
                )}

                {displayData.length > 0 ? (
                    displayData.map((item) => (
                        <DrawerUnit
                            key={`${item.is_manual ? 'off' : 'on'}-${item.id}`}
                            visit={item}
                            onSelectCard={() => {
                                if (selectionMode) {
                                    toggleSelection(item.id);
                                } else {
                                    setSelectedItem(item);
                                    setIsModalVisible(true);
                                }
                            }}
                            onLongPress={() => handleLongPress(item.id)}
                            selectionMode={selectionMode}
                            isSelected={selectedIds.has(item.id)}
                        />
                    ))
                ) : (
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyText, { color: DrawerTheme.woodLight }]}>
                            {timeFilter !== 'ALL' ? '해당 기간에 기록이 없습니다.' : '아직 비어있는 서랍장입니다.'}
                        </Text>
                    </View>
                )}
            </DrawerChest>
        );
    };

    // ✅ 데이터가 없고 로딩 중일 때만 스피너 표시 (캐시된 데이터가 있으면 보여줌)
    const isInitialLoading = isVisitsLoading && !refreshing && displayData.length === 0;

    if (isInitialLoading) return <GradientBackground><LoadingSpinner /></GradientBackground>;

    return (
        <GradientBackground>
            <FlatList
                data={[1]} // Dummy data for rendering layout
                renderItem={renderDrawerChest}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={[
                    styles.scrollContainer,
                    { paddingTop: insets.top + 20 }
                ]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={DrawerTheme.goldBrass} />}
            />

            <TarotCardModal
                isVisible={isModalVisible}
                visit={selectedItem}
                onClose={() => setIsModalVisible(false)}
                onEdit={(id) => {
                    setIsModalVisible(false);
                    navigation.navigate('VisitDetail', {
                        visitId: id,
                        is_manual: selectedItem?.is_manual,
                        mode: selectedItem?.is_manual ? 'manual' : 'server'
                    });
                }}
                onDelete={handleDeleteVisit}
            />
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    scrollContainer: { paddingHorizontal: 20, paddingBottom: 100 },
    manualAddDrawer: { height: 100, margin: 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: DrawerTheme.goldBrass, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
    manualAddText: { fontSize: 16, fontWeight: 'bold' },
    emptyContainer: { padding: 60, alignItems: 'center' },
    emptyText: { fontSize: 16, fontStyle: 'italic' }
});

export default HistoryScreen;
