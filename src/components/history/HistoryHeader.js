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
                    <TouchableOpacity style={styles.statUnit} onPress={onNavigateStamp}>
                        <Text style={styles.statLabel}>스탬프</Text>
                        <Text style={[styles.statValue, { color: DrawerTheme.goldBright }]}>{stats.current_stamps}/10</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <View style={styles.statUnit}>
                        <Text style={styles.statLabel}>방문 횟수</Text>
                        <Text style={styles.statValue}>{stats.visit_count}</Text>
                    </View>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.statUnit} onPress={onNavigateCoupon}>
                        <Text style={styles.statLabel}>보유 쿠폰</Text>
                        <Text style={[styles.statValue, { color: DrawerTheme.goldBright }]}>{couponCount}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        ...CommonStyles.headerBoard,
        paddingBottom: 10,
    },
    titleRow: CommonStyles.titleRow,
    title: CommonStyles.title,
    headerDivider: {
        ...CommonStyles.headerDivider,
        marginBottom: 5, // 아래 스탯과의 간격 확보
    },
    statsContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 5,
        backgroundColor: DrawerTheme.navyDark,
        borderWidth: 1.5,
        borderColor: DrawerTheme.woodFrame,
        borderRadius: 10,
        paddingVertical: 8,
    },
    statUnit: {
        alignItems: 'center',
        flex: 1,
        paddingVertical: 1,
    },
    statLabel: { fontSize: 9, marginBottom: 2, fontWeight: 'bold', color: DrawerTheme.woodLight, opacity: 0.95 },
    statValue: { fontSize: 18, color: '#FFF', fontWeight: 'bold' },
    divider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(210, 166, 121, 0.28)' },
});
