import React, { useCallback, useRef } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ImageBackground } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { LocalSvg } from 'react-native-svg/css';

import {
    LoadingSpinner,
    TarotCardModal,
    HistoryHeader,
    HistoryFilterBar,
    AIHistoryAnalysisPanel
} from '../../components';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { useHistoryLogic } from '../../hooks/useHistoryLogic';

const brassHandleAsset = require('../../../assets/tarot-cellar/brass-handle-b.svg');
const drawerTextureAsset = require('../../../assets/tarot-cellar/drawer-walnut.webp');
const cellarBackgroundAsset = require('../../../assets/tarot-cellar/bg-cellar.webp');

const HistoryScreen = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { state, actions } = useHistoryLogic(navigation);

    const {
        customer,
        isVisitsLoading,
        isDeleting,
        refreshing,
        visits,
        recordType,
        viewMode,
        sortMode,
        recordStatus,
        selectionMode,
        selectedIds,
        isModalVisible,
        selectedItem,
        displayData,
    } = state;

    const {
        setRecordType,
        setViewMode,
        setSortMode,
        setRecordStatus,
        setSelectionMode,
        setSelectedIds,
        setIsModalVisible,
        setSelectedItem,
        refreshAllData,
        handleRefresh,
        toggleSelection,
        handleLongPress,
        handleDeleteVisit,
        handleUpdateVisitReview,
        handleMultiDelete,
    } = actions;

    useFocusEffect(
        useCallback(() => {
            if (customer) {
                refreshAllData();
            }
        }, [customer, refreshAllData])
    );

    const sideTint = recordType === 'personal' ? 'rgba(42,6,44,0.72)' : 'rgba(31,18,12,0.84)';
    // 기록이 아예 없는 것과 필터에 가려진 것은 안내가 달라야 한다
    const isFilteredOut = visits.length > 0;
    const emptyTitle = isFilteredOut ? '조건에 맞는 서랍이 없어요' : '아직 보관된 기록이 없습니다';
    const emptySubtitle = isFilteredOut
        ? '위의 필터를 바꾸면 나머지 기록이 보입니다.'
        : '매장에서 상담을 받으면 서랍이 생깁니다. 개인 기록은 직접 추가할 수 있어요.';

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <HistoryHeader customer={customer} />
            <HistoryFilterBar
                recordType={recordType}
                setRecordType={setRecordType}
                viewMode={viewMode}
                setViewMode={setViewMode}
                sortMode={sortMode}
                setSortMode={setSortMode}
                recordStatus={recordStatus}
                setRecordStatus={setRecordStatus}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                setSelectionMode={setSelectionMode}
                setSelectedIds={setSelectedIds}
                onMultiDelete={handleMultiDelete}
            />

            {/* Chest Top Moldings */}
            <View style={styles.chestContainer}>
                <View style={styles.backLip} />
                <LinearGradient
                    colors={['#120806', DrawerTheme.walnutLight, DrawerTheme.walnutDark, DrawerTheme.walnutLight, '#120806']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.topMolding}
                />
                <LinearGradient
                    colors={['#120A06', DrawerTheme.walnutLight, '#120A06']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.topSubMolding}
                />
            </View>

            {/* Chest Content Header Area (AI Panel & Manual Add) */}
            <LinearGradient
                colors={[sideTint, DrawerTheme.walnutDark, sideTint]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.mainBody, styles.mainBodyHeaderExtension]}
            >
                <View style={styles.sideRailLeft} />
                <View style={styles.sideRailRight} />
                <View style={styles.drawerContentHeader}>
                    <View style={styles.aiPanelSlot}>
                        <AIHistoryAnalysisPanel visits={visits} />
                    </View>

                    {recordType !== 'visit' && (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            style={styles.manualAddDrawer}
                            accessibilityRole="button"
                            accessibilityLabel="개인 서랍 추가"
                            onPress={() => navigation.navigate('VisitDetail', { mode: 'manual', is_manual: true })}
                        >
                            <LinearGradient
                                pointerEvents="none"
                                colors={['rgba(224,184,90,0.10)', 'rgba(31,18,12,0.9)', 'rgba(9,0,13,0.68)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.manualAddPlaque}>
                                <Text style={styles.manualAddPlus}>＋</Text>
                            </View>
                            <View style={styles.manualAddCopy}>
                                <Text style={styles.manualAddText}>개인 서랍 추가</Text>
                                <Text style={styles.manualAddSubtext}>새 라벨을 붙이고 기록을 보관하기</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </LinearGradient>
        </View>
    );

    const renderFooter = () => (
        <View style={styles.footerContainer}>
            {/* Main Body Bottom Extension */}
            <LinearGradient
                colors={[sideTint, DrawerTheme.walnutDark, sideTint]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.mainBody, styles.mainBodyFooterExtension]}
            >
                <View style={styles.sideRailLeft} />
                <View style={styles.sideRailRight} />
            </LinearGradient>

            {/* Chest Legs */}
            <View style={styles.chestContainer}>
                <LinearGradient
                    colors={['#120A06', DrawerTheme.walnutLight, '#120A06']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.bottomMolding}
                />
                <View style={styles.legsRow}>
                    <View style={styles.leg} />
                    <View style={styles.leg} />
                </View>
            </View>
        </View>
    );

    const renderEmptyComponent = () => (
        <View style={styles.emptyContainer}>
            <LinearGradient
                colors={[sideTint, DrawerTheme.walnutDark, sideTint]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.mainBody}
            >
                <View style={styles.sideRailLeft} />
                <View style={styles.sideRailRight} />
                <View style={styles.drawerContent}>
                    <View style={styles.emptyCopyPanel}>
                        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
                        <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
                    </View>
                    <DrawerUnit
                        visit={{
                            id: 'sealed-placeholder',
                            visit_date: '',
                            drawer_title: '닫힌 빈 서랍',
                            isPlaceholder: true,
                        }}
                        onSelectCard={() => {}}
                    />
                </View>
            </LinearGradient>
        </View>
    );

    const renderItem = ({ item }) => {
        if (item.type === 'groupHeader') {
            return (
                <LinearGradient
                    colors={[sideTint, DrawerTheme.walnutDark, sideTint]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.mainBody}
                >
                    <View style={styles.sideRailLeft} />
                    <View style={styles.sideRailRight} />
                    <View style={styles.groupHeaderWrap}>
                        <View style={styles.groupHeaderLine} />
                        <Text style={styles.groupHeaderText}>{item.title}</Text>
                        <View style={styles.groupHeaderLine} />
                    </View>
                </LinearGradient>
            );
        }

        return (
            <LinearGradient
                colors={[sideTint, DrawerTheme.walnutDark, sideTint]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.mainBody}
            >
                <View style={styles.sideRailLeft} />
                <View style={styles.sideRailRight} />
                <View style={styles.drawerContent}>
                    <DrawerUnit
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
                </View>
            </LinearGradient>
        );
    };

    const isInitialLoading = isVisitsLoading && !refreshing && displayData.length === 0;

    if (isInitialLoading) return <CellarBackground><LoadingSpinner /></CellarBackground>;

    return (
        <CellarBackground>
            <FlatList
                testID="history-scroll"
                data={displayData}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={renderEmptyComponent}
                keyExtractor={(item) => `${item.type === 'groupHeader' ? 'group' : (item.is_manual ? 'personal' : 'visit')}-${item.id}`}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                style={styles.list}
                contentContainerStyle={[
                    styles.scrollContainer,
                    { paddingTop: insets.top + 10 }
                ]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={DrawerTheme.goldBrass} />}
            />

            {isDeleting && (
                <View style={styles.busyOverlay}>
                    <View style={styles.busyCard}>
                        <ActivityIndicator size="small" color={DrawerTheme.brightGold} />
                        <Text style={styles.busyText}>서랍을 정리하는 중…</Text>
                    </View>
                </View>
            )}

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
                onApplyCondensedMemo={handleUpdateVisitReview}
            />
        </CellarBackground>
    );
};

const CellarBackground = ({ children }) => (
    <View style={styles.cellarBackground}>
        <ImageBackground
            source={cellarBackgroundAsset}
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

const DrawerUnit = React.memo(({ visit, onSelectCard, onLongPress, selectionMode, isSelected }) => {
    const suppressNextPressRef = useRef(false);
    const isPlaceholder = visit.isPlaceholder === true;
    const isManualMode = visit.is_manual === true;
    const isOnMode = !isManualMode;
    const isWritten = !!(visit.card_review && visit.card_review.trim()) || !!visit.card_image;
    const title = visit.title
        || visit.drawer_title
        || (visit.card_review?.trim()?.split('\n')[0] || '').slice(0, 28)
        || (isManualMode ? '개인 기록' : '타로 기록');
    const subtitle = visit.drawer_subtitle;
    const displayDate = visit.visit_date
        ? visit.visit_date.split('T')[0].split('-').join(' · ')
        : '';
    const status = isPlaceholder ? '빈 서랍' : (isWritten ? '기록 있음' : '기록 없음');
    const modeLabel = isPlaceholder ? 'SEALED' : (isManualMode ? 'PRIVATE' : 'VISIT');

    return (
        <View style={styles.drawerWrapper}>
            <TouchableOpacity
                testID={`history-drawer-${visit.id}`}
                accessibilityRole="button"
                accessibilityLabel={selectionMode ? `${title} 선택 토글` : `${title} 상세 보기`}
                accessibilityState={{ selected: !!isSelected }}
                activeOpacity={0.9}
                onPress={() => {
                    if (suppressNextPressRef.current) {
                        suppressNextPressRef.current = false;
                        return;
                    }
                    onSelectCard(visit);
                }}
                onLongPress={() => {
                    suppressNextPressRef.current = true;
                    onLongPress?.();
                }}
                delayLongPress={500}
                style={[
                    styles.drawer,
                    isPlaceholder && styles.placeholderDrawer,
                    (isOnMode && !isWritten && !isPlaceholder) && styles.unwrittenDrawer,
                    isSelected && styles.selectedDrawer
                ]}
            >
                <ImageBackground
                    source={drawerTextureAsset}
                    resizeMode="cover"
                    style={StyleSheet.absoluteFill}
                    imageStyle={styles.drawerTexture}
                >
                    <LinearGradient
                        colors={['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.28)']}
                        locations={[0, 0.52, 1]}
                        style={StyleSheet.absoluteFill}
                    />
                    <LinearGradient
                        colors={['rgba(0,0,0,0.34)', 'transparent', 'transparent', 'rgba(0,0,0,0.34)']}
                        locations={[0, 0.18, 0.82, 1]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={StyleSheet.absoluteFill}
                    />
                </ImageBackground>

                <View style={styles.drawerInnerFrame}>
                    {selectionMode && (
                        <View style={styles.checkboxContainer}>
                            <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                                {isSelected && <Text style={styles.checkmark}>✓</Text>}
                            </View>
                        </View>
                    )}

                    {isSelected && <View pointerEvents="none" style={styles.selectedGlow} />}

                    <View style={styles.drawerTopRail}>
                        <Text numberOfLines={1} style={styles.drawerModeLabel}>{modeLabel}</Text>
                        {!!displayDate && (
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.drawerDate}>
                                {displayDate}
                            </Text>
                        )}
                    </View>

                    <View style={styles.drawerMainRow}>
                        <View style={styles.drawerLeft}>
                            <View style={styles.sealedPlaque}>
                                <Text numberOfLines={1} style={styles.sealedText}>{status}</Text>
                            </View>
                        </View>

                        <View style={styles.drawerCenter}>
                            <LocalSvg
                                asset={brassHandleAsset}
                                style={styles.brassHandle}
                                width={84}
                                height={32}
                            />
                        </View>

                        <View style={styles.drawerRight}>
                            <View style={styles.drawerRightLine} />
                        </View>
                    </View>

                    <View style={styles.drawerTitlePlate}>
                        <Text numberOfLines={1} style={[styles.drawerTitle, isPlaceholder && styles.placeholderTitle]}>{title}</Text>
                        {!!subtitle && <Text numberOfLines={1} style={styles.drawerSubtitle}>{subtitle}</Text>}
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
});

const styles = StyleSheet.create({
    cellarBackground: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: DrawerTheme.bgBlackPurple,
    },
    bgCellar: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.16,
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
        overflow: 'hidden',
    },
    scrollContainer: {
        paddingHorizontal: 14,
        paddingBottom: 16,
        width: '100%',
        maxWidth: 393,
        alignSelf: 'center',
    },
    headerContainer: {
        width: '100%',
    },
    footerContainer: {
        width: '100%',
    },
    emptyContainer: {
        width: '100%',
    },
    groupHeaderWrap: {
        minHeight: 36,
        paddingHorizontal: 22,
        paddingTop: 10,
        paddingBottom: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    groupHeaderLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(224,184,90,0.24)',
    },
    groupHeaderText: {
        color: DrawerTheme.brightGold,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    manualAddDrawer: {
        minHeight: 64,
        marginHorizontal: 5,
        marginTop: 2,
        marginBottom: 8,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: DrawerTheme.archiveBorderStrong,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        overflow: 'hidden',
        backgroundColor: DrawerTheme.archiveSealed,
    },
    manualAddPlaque: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.62)',
        backgroundColor: 'rgba(18,0,8,0.62)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    manualAddPlus: {
        color: DrawerTheme.brightGold,
        fontSize: 22,
        lineHeight: 26,
        fontWeight: '900',
    },
    manualAddCopy: {
        flex: 1,
        minWidth: 0,
    },
    manualAddText: {
        fontSize: 15,
        fontWeight: '900',
        color: DrawerTheme.ivory,
        letterSpacing: 0.3,
    },
    manualAddSubtext: {
        marginTop: 4,
        fontSize: 11,
        lineHeight: 15,
        color: DrawerTheme.mutedIvory,
        opacity: 0.78,
    },
    chestContainer: {
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.55,
        shadowRadius: 18,
        elevation: 10,
    },
    backLip: {
        width: '100%',
        height: 5,
        backgroundColor: '#1A0E08',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(224,184,90,0.24)',
    },
    topMolding: {
        width: '100%',
        height: 8,
        borderTopLeftRadius: 5,
        borderTopRightRadius: 5,
        borderTopWidth: 1,
        borderColor: 'rgba(224,184,90,0.34)',
    },
    topSubMolding: {
        width: '100%',
        height: 5,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(0,0,0,0.62)',
    },
    mainBody: {
        borderLeftWidth: 2,
        borderRightWidth: 2,
        borderColor: 'rgba(12,6,4,0.72)',
        overflow: 'hidden',
    },
    mainBodyHeaderExtension: {
        borderBottomWidth: 0,
    },
    mainBodyFooterExtension: {
        height: 10,
        borderTopWidth: 0,
    },
    sideRailLeft: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 4,
        width: 2,
        backgroundColor: 'rgba(224,184,90,0.1)',
    },
    sideRailRight: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 4,
        width: 2,
        backgroundColor: 'rgba(224,184,90,0.1)',
    },
    drawerContent: {
        paddingVertical: 4,
        paddingHorizontal: 5,
    },
    drawerContentHeader: {
        paddingTop: 6,
        paddingHorizontal: 4,
    },
    aiPanelSlot: {
        marginHorizontal: 3,
        marginBottom: 4,
        borderRadius: 10,
        overflow: 'hidden',
    },
    emptyCopyPanel: {
        marginHorizontal: 4,
        marginTop: 2,
        marginBottom: 8,
        paddingVertical: 11,
        paddingHorizontal: 13,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: DrawerTheme.archiveBorder,
        backgroundColor: 'rgba(9,0,13,0.46)',
        alignItems: 'center',
    },
    emptyTitle: {
        color: DrawerTheme.ivory,
        fontSize: 14,
        lineHeight: 19,
        fontWeight: '900',
        textAlign: 'center',
    },
    emptySubtitle: {
        marginTop: 4,
        color: DrawerTheme.mutedIvory,
        fontSize: 11.5,
        lineHeight: 16,
        textAlign: 'center',
        opacity: 0.82,
    },
    bottomMolding: {
        width: '100%',
        height: 12,
        borderBottomLeftRadius: 4,
        borderBottomRightRadius: 4,
        borderTopWidth: 1,
        borderColor: 'rgba(224,184,90,0.22)',
    },
    legsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 34,
        marginTop: -2,
        marginBottom: 6,
    },
    leg: {
        width: 22,
        height: 14,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
        backgroundColor: DrawerTheme.walnutDark,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: 'rgba(224,184,90,0.2)',
    },
    drawerWrapper: {
        width: '100%',
        marginBottom: 7,
        borderBottomWidth: 2,
        borderBottomColor: 'rgba(5,2,1,0.58)',
    },
    drawer: {
        width: '100%',
        minHeight: 96,
        borderRadius: 12,
        padding: 6,
        borderTopWidth: 1,
        borderBottomWidth: 2,
        borderTopColor: 'rgba(244,232,208,0.08)',
        borderBottomColor: 'rgba(0,0,0,0.42)',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 4,
    },
    drawerTexture: {
        opacity: 0.82,
    },
    unwrittenDrawer: {
        opacity: 0.84,
    },
    placeholderDrawer: {
        opacity: 0.72,
    },
    selectedDrawer: {
        borderWidth: 2,
        borderColor: DrawerTheme.brassHighlight,
        shadowColor: DrawerTheme.brassHighlight,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 7,
    },
    drawerInnerFrame: {
        borderWidth: 1,
        borderColor: DrawerTheme.archiveBorderStrong,
        backgroundColor: 'rgba(0,0,0,0.08)',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 7,
        overflow: 'hidden',
    },
    selectedGlow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 7,
        backgroundColor: 'rgba(224,184,90,0.10)',
    },
    drawerTopRail: {
        minHeight: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 2,
    },
    drawerModeLabel: {
        color: DrawerTheme.mutedIvory,
        fontSize: 8,
        lineHeight: 11,
        fontWeight: '900',
        letterSpacing: 1.3,
        opacity: 0.7,
    },
    drawerMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 36,
        minWidth: 0,
    },
    drawerLeft: {
        width: '30%',
        maxWidth: 104,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    drawerCenter: {
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    drawerRight: {
        width: '30%',
        maxWidth: 104,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    drawerRightLine: {
        width: '76%',
        height: 1,
        backgroundColor: 'rgba(224,184,90,0.24)',
    },
    sealedPlaque: {
        maxWidth: 96,
        minHeight: 26,
        paddingHorizontal: 9,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.42)',
        backgroundColor: 'rgba(31,18,12,0.68)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sealedText: {
        color: DrawerTheme.brightGold,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.4,
    },
    brassHandle: {
        width: 84,
        height: 32,
        opacity: 0.96,
    },
    drawerDate: {
        color: DrawerTheme.brightGold,
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
        textShadowColor: 'rgba(0,0,0,0.72)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    drawerTitle: {
        color: DrawerTheme.ivory,
        fontSize: 13,
        lineHeight: 17,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: 0.2,
        textShadowColor: 'rgba(0,0,0,0.72)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    drawerTitlePlate: {
        marginTop: 3,
        minHeight: 23,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(244,232,208,0.08)',
        backgroundColor: 'rgba(9,0,13,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    drawerSubtitle: {
        marginTop: 2,
        color: DrawerTheme.mutedIvory,
        fontSize: 10,
        lineHeight: 13,
        textAlign: 'center',
        opacity: 0.74,
    },
    placeholderTitle: {
        color: DrawerTheme.mutedIvory,
        opacity: 0.82,
    },
    checkboxContainer: {
        position: 'absolute',
        top: 5,
        left: 5,
        zIndex: 3,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(224,184,90,0.45)',
        backgroundColor: 'rgba(9,0,13,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: {
        borderColor: DrawerTheme.brassHighlight,
        backgroundColor: DrawerTheme.brass,
        shadowColor: DrawerTheme.brassHighlight,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.65,
        shadowRadius: 6,
    },
    checkmark: {
        fontSize: 14,
        color: DrawerTheme.bgBlackCherry,
        fontWeight: '900',
    },
    // 서버 삭제는 왕복이 있어 누른 직후 아무 일도 없는 것처럼 보인다.
    // 그동안 목록을 잠가 두 번 지우는 것도 막는다.
    busyOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(5,0,8,0.52)',
    },
    busyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: DrawerTheme.archiveBorderStrong,
        backgroundColor: DrawerTheme.bgDeepPurple,
    },
    busyText: {
        color: DrawerTheme.ivory,
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
});

export default HistoryScreen;





