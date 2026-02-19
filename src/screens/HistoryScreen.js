import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Platform, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Components
import { GradientBackground } from '../components/GradientBackground';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { DrawerChest } from '../components/DrawerChest';
import { DrawerUnit } from '../components/DrawerUnit';
import { TarotCardModal } from '../components/TarotCardModal';
import { HistoryHeader } from '../components/history/HistoryHeader';
import { HistoryFilterBar } from '../components/history/HistoryFilterBar';
import { DrawerTheme } from '../constants/DrawerTheme';

// Hook
import { useHistoryLogic } from '../hooks/useHistoryLogic';

const HistoryScreen = ({ navigation }) => {
  const {
    state,
    actions,
    getDisplayData
  } = useHistoryLogic(navigation);

  const {
    customer,
    isVisitsLoading,
    refreshing,
    stats,
    couponCount,
    archiveMode,
    timeFilter,
    selectedYear,
    selectedMonth,
    selectionMode,
    selectedIds,
    isModalVisible,
    selectedItem,
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
        archiveMode={archiveMode}
        onSetArchiveMode={setArchiveMode}
        onNavigateCoupon={() => navigation.navigate('Coupon')}
      />
      <HistoryFilterBar
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        setSelectionMode={setSelectionMode}
        setSelectedIds={setSelectedIds}
        onMultiDelete={handleMultiDelete}
      />
    </>
  );

  const renderDrawerChest = () => {
    const displayData = getDisplayData();
    return (
      <DrawerChest isManualMode={archiveMode === 'OFF'} selectionMode={selectionMode}>
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
  const isInitialLoading = isVisitsLoading && !refreshing && (!getDisplayData() || getDisplayData().length === 0);

  if (isInitialLoading) return <GradientBackground><LoadingSpinner /></GradientBackground>;

  return (
    <GradientBackground>
      <FlatList
        data={[1]} // Dummy data for rendering layout
        renderItem={renderDrawerChest}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.scrollContainer}
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
  scrollContainer: { paddingBottom: 80 },
  manualAddDrawer: { height: 100, margin: 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: DrawerTheme.goldBrass, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  manualAddText: { fontSize: 16, fontWeight: 'bold' },
  emptyContainer: { padding: 60, alignItems: 'center' },
  emptyText: { fontSize: 16, fontStyle: 'italic' }
});

export default HistoryScreen;