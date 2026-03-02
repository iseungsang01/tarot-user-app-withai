import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CommonStyles } from '../../styles/CommonStyles';

export const HistoryHeader = ({
    stats,
    couponCount,
    onNavigateCoupon,
    onNavigateStamp
}) => {
    return (
        <View style={{ width: '100%', alignItems: 'center' }}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Text style={styles.title}>DRAWERS</Text>
                </View>
                <View style={styles.headerDivider} />

                {/* Integrated Stats UI */}
                <View style={styles.statsContainer}>
                    <TouchableOpacity style={styles.statBox} onPress={onNavigateStamp}>
                        <Text style={[styles.statLabel, { color: DrawerTheme.woodLight }]}>스탬프</Text>
                        <Text style={[styles.statValue, { color: DrawerTheme.goldBright }]}>{stats.current_stamps}/10</Text>
                    </TouchableOpacity>
                    <View style={[styles.divider, { backgroundColor: DrawerTheme.woodFrame }]} />
                    <View style={styles.statBox}>
                        <Text style={[styles.statLabel, { color: DrawerTheme.woodLight }]}>방문 횟수</Text>
                        <Text style={styles.statValue}>{stats.visit_count}</Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: DrawerTheme.woodFrame }]} />
                    <TouchableOpacity style={styles.statBox} onPress={onNavigateCoupon}>
                        <Text style={[styles.statLabel, { color: DrawerTheme.woodLight }]}>보유 쿠폰</Text>
                        <Text style={[styles.statValue, { color: DrawerTheme.goldBright }]}>{couponCount}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: CommonStyles.headerBoard,
    titleRow: CommonStyles.titleRow,
    title: CommonStyles.title,
    headerDivider: {
        ...CommonStyles.headerDivider,
        marginBottom: 15, // 아래 스탯과의 간격 확보
    },
    statsContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginTop: 5
    },
    statBox: { alignItems: 'center', flex: 1 },
    statLabel: { fontSize: 9, marginBottom: 4, fontWeight: 'bold', opacity: 0.8 },
    statValue: { fontSize: 18, color: '#FFF', fontWeight: 'bold' },
    divider: { width: 1.5, height: 25, opacity: 0.5 },
});
