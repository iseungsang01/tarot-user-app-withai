import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DrawerMark, GradientBackground, LoadingSpinner, NoticeCard, PremiumCard } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { noticeService } from '../../services/noticeService';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CommonStyles } from '../../styles/CommonStyles';

const NoticeScreen = ({ isIntegrated = false }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { customer } = useAuth();
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        const { data, error } = await noticeService.getNotices();
        if (!error) setNotices(data);
        if (customer) await noticeService.markAllNoticesAsRead();
        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [customer])
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.titleRow}>
                <Text style={styles.title}>NOTICE BOARD</Text>
            </View>
            <View style={styles.headerDivider} />
            <Text style={styles.subtitle}>매장의 새로운 소식을 확인하세요</Text>
        </View>
    );

    if (loading) return <GradientBackground><LoadingSpinner /></GradientBackground>;

    return (
        <View style={{ flex: 1 }}>
            <FlatList
                data={notices}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => <NoticeCard notice={item} onPress={(notice) => navigation.navigate('NoticeDetail', { notice })} />}
                ListHeaderComponent={!isIntegrated ? renderHeader : null}
                ListEmptyComponent={
                    <PremiumCard style={styles.emptyBox} contentStyle={styles.emptyContent}>
                        <View style={styles.emptyFlap} />
                        <DrawerMark size={44} style={styles.emptyMark} />
                        <Text style={styles.emptyText}>아직 등록된 소식이 없습니다.</Text>
                    </PremiumCard>
                }
                contentContainerStyle={[
                    styles.listArea,
                    { paddingTop: !isIntegrated ? (insets.top + 20) : 10 }
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={DrawerTheme.goldBrass}
                    />
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    listArea: {
        padding: 20,
        paddingBottom: 100
    },

    // 헤더 (CommonStyles 적용)
    header: CommonStyles.headerBoard,
    titleRow: CommonStyles.titleRow,
    title: CommonStyles.title,
    headerDivider: CommonStyles.headerDivider,
    subtitle: CommonStyles.subtitle,

    emptyBox: {
        padding: 16,
    },
    emptyContent: {
        width: '100%',
        minHeight: 134,
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(200,163,64,0.28)',
        backgroundColor: 'rgba(31,18,12,0.46)',
        overflow: 'hidden',
        gap: 10,
    },
    emptyFlap: {
        position: 'absolute',
        top: -54,
        width: '80%',
        height: 110,
        transform: [{ rotate: '45deg' }],
        borderWidth: 1,
        borderColor: 'rgba(200,163,64,0.16)',
        backgroundColor: 'rgba(18,0,8,0.28)',
    },
    emptyMark: {
        alignSelf: 'center',
    },
    emptyText: {
        width: '100%',
        fontSize: 13,
        color: DrawerTheme.ivory,
        fontWeight: '700',
        textAlign: 'center',
    },
});

export default NoticeScreen;
