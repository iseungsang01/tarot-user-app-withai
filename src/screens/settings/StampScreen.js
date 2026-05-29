import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground } from '../../components/common/GradientBackground';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CommonStyles } from '../../styles/CommonStyles';
import { useAuth } from '../../hooks/useAuth';

const MAX_STAMPS = 10;

const tarotCards = [
    { name: 'The Fool', image: require('../../../assets/card/0. The Fool.png') },
    { name: 'The Magician', image: require('../../../assets/card/1. The Magician.png') },
    { name: 'The High Priestess', image: require('../../../assets/card/2. The High Priestess.png') },
    { name: 'The Empress', image: require('../../../assets/card/3. The Empress.png') },
    { name: 'The Emperor', image: require('../../../assets/card/4. The Emperor.png') },
    { name: 'The Hierophant', image: require('../../../assets/card/5. The Hierophant.png') },
    { name: 'The Lovers', image: require('../../../assets/card/6. The Lovers.png') },
    { name: 'The Chariot', image: require('../../../assets/card/7. Chariot.png') },
    { name: 'Strength', image: require('../../../assets/card/8. Strength.png') },
    { name: 'The Hermit', image: require('../../../assets/card/9. The Hermit.png') },
];

const StampScreen = () => {
    const insets = useSafeAreaInsets();
    const { customer } = useAuth();
    const [currentCustomer, setCurrentCustomer] = useState(customer);

    useEffect(() => {
        setCurrentCustomer(customer);
    }, [customer]);

    const currentStamps = useMemo(() => Number(currentCustomer?.current_stamps) || 0, [currentCustomer]);
    const cappedStamps = Math.max(0, Math.min(currentStamps, MAX_STAMPS));
    const progressPercent = (cappedStamps / MAX_STAMPS) * 100;

    return (
        <GradientBackground>
            <ScrollView
                contentContainerStyle={[
                    styles.wrapper,
                    { paddingTop: insets.top + 20 }
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>STAMP BOARD</Text>
                    </View>
                    <View style={styles.headerDivider} />
                    <Text style={styles.subtitle}>오늘의 상담을 타로 카드 조각으로 모아보세요.</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusBadgeText}>진행</Text>
                        </View>
                        <Text style={styles.cardHeaderText}>현재 적립 현황</Text>
                        <View style={{ flex: 1 }} />
                        <Text style={styles.progressValue}>
                            <Text style={styles.currentCount}>{cappedStamps}</Text>
                            <Text style={styles.totalCount}> / {MAX_STAMPS}</Text>
                        </Text>
                    </View>

                    <View style={styles.contentContainer}>
                        <View style={styles.progressBarContainer}>
                            <View style={styles.progressBarBg}>
                                <LinearGradient
                                    colors={[DrawerTheme.goldBrass, DrawerTheme.goldBright]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                                />
                            </View>
                        </View>

                        <Text style={styles.rewardHint}>
                            {cappedStamps >= MAX_STAMPS
                                ? '모든 스탬프를 모았습니다! 쿠폰함을 확인해주세요.'
                                : `앞으로 ${MAX_STAMPS - cappedStamps}개의 스탬프를 더 모으면 쿠폰이 발송됩니다.`}
                        </Text>
                    </View>
                </View>

                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.collectionBadge}>
                            <Text style={styles.collectionBadgeText}>COLLECTION</Text>
                        </View>
                        <Text style={styles.cardHeaderText}>TAROT CARDS</Text>
                    </View>

                    <View style={styles.contentContainer}>
                        <View style={styles.stampGrid}>
                            {tarotCards.map((card, i) => {
                                const filled = i < cappedStamps;
                                return (
                                    <View key={card.name} style={styles.stampWrapper}>
                                        <View style={[styles.stampFrame, filled && styles.stampFrameFilled]}>
                                            <Image
                                                source={card.image}
                                                style={[styles.cardImage, !filled && styles.cardImageLocked]}
                                                resizeMode="cover"
                                            />
                                            {!filled && <View style={styles.lockedOverlay} />}
                                            {filled ? (
                                                <LinearGradient
                                                    colors={['rgba(255, 235, 170, 0.22)', 'rgba(212, 175, 55, 0)']}
                                                    style={styles.stampInnerGlow}
                                                />
                                            ) : (
                                                <View style={styles.lockedBadge}>
                                                    <Text style={styles.indexText}>{i + 1}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        <View style={styles.cardFooter}>
                            <Text style={styles.footerText}>10 STAMPS = 1 FREE SESSION COUPON</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.noticeBox}>
                    <Text style={styles.noticeTitle}>이용 안내</Text>
                    <View style={styles.noticeContent}>
                        <Text style={styles.noticeText}>• 상담 완료 시 자동으로 스탬프가 적립됩니다.</Text>
                        <Text style={styles.noticeText}>• 10개를 모두 모으면 무료 상담 쿠폰이 발송됩니다.</Text>
                        <Text style={styles.noticeText}>• 발급된 쿠폰의 유효기간은 발행일로부터 3개월입니다.</Text>
                        <Text style={styles.noticeText}>• 스탬프 적립 내역은 본인 계정에서만 유효합니다.</Text>
                    </View>
                </View>
            </ScrollView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    wrapper: { paddingHorizontal: 20, paddingBottom: 100 },
    header: CommonStyles.headerBoard,
    titleRow: CommonStyles.titleRow,
    title: CommonStyles.title,
    headerDivider: CommonStyles.headerDivider,
    subtitle: CommonStyles.subtitle,

    card: {
        backgroundColor: '#4A3728',
        borderRadius: 16,
        padding: 22,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    cardHeaderText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    contentContainer: {
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },

    statusBadge: {
        backgroundColor: DrawerTheme.goldBrass,
        borderRadius: 4,
        paddingVertical: 2,
        paddingHorizontal: 6,
        marginRight: 8,
    },
    statusBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#3D2B1F',
    },
    collectionBadge: {
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        borderRadius: 4,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        marginRight: 8,
    },
    collectionBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: DrawerTheme.goldBrass,
    },

    progressValue: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    currentCount: {
        color: DrawerTheme.goldBright,
        fontSize: 22,
        fontWeight: 'bold',
    },
    totalCount: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 14,
        fontWeight: '600',
    },
    progressBarContainer: {
        height: 8,
        width: '100%',
        marginBottom: 12,
    },
    progressBarBg: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    rewardHint: {
        color: '#A68966',
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
        opacity: 0.8,
    },

    stampGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
    },
    stampWrapper: {
        width: '18.5%',
        aspectRatio: 0.68,
        marginVertical: 5,
    },
    stampFrame: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.35)',
        overflow: 'hidden',
    },
    stampFrameFilled: {
        borderColor: DrawerTheme.goldBrass,
        borderWidth: 1.5,
        shadowColor: DrawerTheme.goldBright,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 5,
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    cardImageLocked: {
        opacity: 0.34,
    },
    lockedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(18, 12, 8, 0.52)',
    },
    stampInnerGlow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 8,
    },
    lockedBadge: {
        position: 'absolute',
        top: 5,
        right: 5,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.48)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.25)',
    },
    indexText: {
        color: 'rgba(255, 230, 160, 0.74)',
        fontSize: 11,
        fontWeight: '900',
    },
    cardFooter: {
        marginTop: 20,
        alignItems: 'center',
    },
    footerText: {
        color: DrawerTheme.goldBrass,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        opacity: 0.9,
    },

    noticeBox: {
        backgroundColor: 'rgba(139, 90, 43, 0.05)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(139, 90, 43, 0.15)',
        marginTop: 8,
    },
    noticeTitle: {
        color: DrawerTheme.woodLight,
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    noticeContent: {
        gap: 6,
    },
    noticeText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        lineHeight: 18,
    }
});

export default StampScreen;
