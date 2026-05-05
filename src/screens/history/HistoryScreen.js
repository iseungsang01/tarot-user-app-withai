import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ImageBackground } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import {
    LoadingSpinner,
    DrawerChest,
    DrawerUnit,
    TarotCardModal,
    HistoryHeader,
    HistoryFilterBar,
    AIHistoryAnalysisPanel
} from '../../components';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { useHistoryLogic } from '../../hooks/useHistoryLogic';

const HistoryScreen = ({ onCaptureCoachFrame, currentCoachStepKey, advanceCoachStep }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { state, actions } = useHistoryLogic(navigation);

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

    const renderDrawerChest = () => (
        <DrawerChest isManualMode={archiveMode === 'OFF'} selectionMode={selectionMode}>
            <AIHistoryAnalysisPanel visits={visits} />

            {archiveMode === 'OFF' && (
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.manualAddDrawer}
                    onPress={() => navigation.navigate('VisitDetail', { mode: 'manual', is_manual: true })}
                >
                    <Text style={styles.manualAddText}>+ 개인 메모 서랍 추가</Text>
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
                Array.from({ length: 4 }).map((_, index) => (
                    <DrawerUnit
                        key={`sealed-placeholder-${index}`}
                        visit={{
                            id: `sealed-placeholder-${index}`,
                            visit_date: '2026-01-26',
                            drawer_title: timeFilter !== 'ALL' ? '해당 기간 기록 없음' : '아직 봉인된 서랍',
                            isPlaceholder: true,
                        }}
                        onSelectCard={() => {}}
                    />
                ))
            )}
        </DrawerChest>
    );

    const isInitialLoading = isVisitsLoading && !refreshing && displayData.length === 0;

    if (isInitialLoading) return <CellarBackground><LoadingSpinner /></CellarBackground>;

    return (
        <CellarBackground>
            <FlatList
                testID="history-scroll"
                data={[1]}
                renderItem={renderDrawerChest}
                ListHeaderComponent={renderHeader}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                style={styles.list}
                contentContainerStyle={[
                    styles.scrollContainer,
                    { paddingTop: insets.top + 10 }
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
        </CellarBackground>
    );
};

const CellarBackground = ({ children }) => (
    <View style={styles.cellarBackground}>
        <ImageBackground
            source={require('../../../assets/tarot-cellar/bg-cellar.png')}
            resizeMode="cover"
            style={styles.bgCellar}
            imageStyle={styles.bgCellarImage}
            pointerEvents="none"
        />
        <LinearGradient
            pointerEvents="none"
            colors={['rgba(9,0,13,0.9)', 'rgba(20,0,24,0.95)', 'rgba(34,5,31,0.96)', 'rgba(18,0,8,0.98)']}
            locations={[0, 0.36, 0.7, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.goldGlow} />
        <View pointerEvents="none" style={styles.wineGlow} />
        <View pointerEvents="none" style={styles.noiseLayer} />
        <View pointerEvents="none" style={styles.vignetteTop} />
        <View pointerEvents="none" style={styles.vignetteBottom} />
        {children}
    </View>
);

const styles = StyleSheet.create({
    cellarBackground: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: DrawerTheme.bgBlackPurple,
    },
    bgCellar: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.24,
    },
    bgCellarImage: {
        width: '100%',
        height: '100%',
    },
    goldGlow: {
        position: 'absolute',
        width: 112,
        height: 168,
        borderRadius: 56,
        right: 0,
        top: 38,
        backgroundColor: 'rgba(200,163,64,0.055)',
    },
    wineGlow: {
        position: 'absolute',
        width: 210,
        height: 180,
        borderRadius: 115,
        left: 0,
        bottom: 96,
        backgroundColor: 'rgba(74,15,43,0.16)',
    },
    noiseLayer: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.045,
        backgroundColor: 'rgba(244,232,208,0.035)',
    },
    vignetteTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 118,
        backgroundColor: 'rgba(0,0,0,0.28)',
    },
    vignetteBottom: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 188,
        backgroundColor: 'rgba(0,0,0,0.34)',
    },
    list: {
        flex: 1,
        width: '100%',
        marginBottom: 74,
        overflow: 'hidden',
    },
    scrollContainer: {
        paddingHorizontal: 20,
        paddingBottom: 136,
        width: '100%',
        maxWidth: 393,
        alignSelf: 'center',
    },
    manualAddDrawer: {
        height: 86,
        margin: 2,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(224,184,90,0.58)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 5,
        backgroundColor: 'rgba(20,0,24,0.7)',
    },
    manualAddText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: DrawerTheme.brightGold,
    },
});

export default HistoryScreen;
