import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { GradientBackground } from '../components';
import { Colors } from '../constants/Colors';
import { DrawerTheme } from '../constants/DrawerTheme';
import { CommonStyles } from '../styles/CommonStyles';
import { useAuth } from '../hooks/useAuth';
import { noticeService } from '../services/noticeService';
import { voteService } from '../services/voteService';
import { couponService } from '../services/couponService';

const INITIAL_SHOPS = [
    {
        id: 1,
        name: '타로 마스터 루나',
        description: '신비로운 기운이 깃든 타로 전문점',
        address: '서울시 강남구 테헤란로 123',
        emoji: '🌙',
        noticeCount: 0,
        couponCount: 0,
        voteCount: 0
    }
];

const ShopListScreen = ({ navigation }) => {
    const { customer } = useAuth();
    const [shops, setShops] = useState(INITIAL_SHOPS);
    const [refreshing, setRefreshing] = useState(false);

    /**
     * 매장 정보 및 숫자(소식, 투표, 쿠폰) 로드
     */
    const loadData = async () => {
        try {
            // 소식, 투표, 쿠폰 개수 동시 조회
            const [noticesRes, votesRes, couponsRes] = await Promise.all([
                noticeService.getNotices(),
                voteService.getVotes(),
                couponService.getValidCouponCount(customer?.id)
            ]);

            const noticeCount = noticesRes.data?.length || 0;
            const voteCount = votesRes.data?.length || 0;
            const couponCount = couponsRes.count || 0;

            // 현재는 단일 매장 시스템이므로 전체 카운트를 매장에 적용
            setShops(prevShops => prevShops.map(shop => ({
                ...shop,
                noticeCount,
                voteCount,
                couponCount
            })));
        } catch (error) {
            console.error('ShopListScreen loadData error:', error);
        }
    };

    // 화면 포커스 시 데이터 새로고침
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [customer?.id])
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const renderShopItem = ({ item }) => (
        <TouchableOpacity
            style={styles.shopCard}
            onPress={() => navigation.navigate('ShopContents', { shop: item })}
            activeOpacity={0.8}
        >
            <View style={styles.shopIconContainer}>
                <Text style={styles.shopEmoji}>{item.emoji}</Text>
            </View>
            <View style={styles.shopInfo}>
                <Text style={styles.shopName}>{item.name}</Text>
                <Text style={styles.shopDesc}>{item.description}</Text>
                <View style={styles.badgeRow}>
                    <View style={[styles.badge, styles.noticeBadge]}>
                        <Text style={styles.badgeText}>📢 {item.noticeCount}</Text>
                    </View>
                    <View style={[styles.badge, styles.couponBadge]}>
                        <Text style={styles.badgeText}>🎟️ {item.couponCount}</Text>
                    </View>
                    <View style={[styles.badge, styles.voteBadge]}>
                        <Text style={styles.badgeText}>🗳️ {item.voteCount}</Text>
                    </View>
                </View>
            </View>
            <Text style={styles.arrow}>❯</Text>
        </TouchableOpacity>
    );

    return (
        <GradientBackground>
            <FlatList
                data={shops}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderShopItem}
                ListHeaderComponent={() => (
                    <View style={styles.header}>
                        <View style={styles.titleRow}>
                            <Text style={styles.title}>SHOP LIST</Text>
                        </View>
                        <View style={styles.headerDivider} />
                        <Text style={styles.subtitle}>방문하실 매장을 선택해주세요</Text>
                    </View>
                )}
                contentContainerStyle={styles.container}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={Colors.gold}
                    />
                }
            />
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    header: CommonStyles.headerBoard,
    titleRow: CommonStyles.titleRow,
    title: CommonStyles.title,
    headerDivider: CommonStyles.headerDivider,
    subtitle: CommonStyles.subtitle,

    shopCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 15,
        padding: 20,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    shopIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    shopEmoji: {
        fontSize: 30,
    },
    shopInfo: {
        flex: 1,
    },
    shopName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.gold,
        marginBottom: 4,
    },
    shopDesc: {
        fontSize: 13,
        color: DrawerTheme.woodLight,
        marginBottom: 8,
        opacity: 0.8,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 0.5,
    },
    noticeBadge: {
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        borderColor: 'rgba(255, 68, 68, 0.3)',
    },
    couponBadge: {
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        borderColor: 'rgba(255, 215, 0, 0.3)',
    },
    voteBadge: {
        backgroundColor: 'rgba(138, 43, 226, 0.1)',
        borderColor: 'rgba(138, 43, 226, 0.3)',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFF',
    },
    arrow: {
        color: Colors.gold,
        fontSize: 18,
        opacity: 0.5,
        marginLeft: 10,
    },
});

export default ShopListScreen;

