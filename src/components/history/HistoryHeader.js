import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { DrawerTheme } from '../../constants/DrawerTheme';

export const HistoryHeader = ({
    stats,
    couponCount,
    archiveMode,
    onSetArchiveMode,
    onNavigateCoupon
}) => {
    return (
        <View style={styles.header}>
            <Text style={[styles.title, { color: DrawerTheme.goldBrass }]}>
                {archiveMode === 'OFF' ? 'PRIVATE NOTES' : 'TAROT ARCHIVE'}
            </Text>

            {/* Stats Board */}
            <View style={[styles.brassBoard, { backgroundColor: DrawerTheme.woodDark, borderColor: DrawerTheme.woodFrame }]}>
                <View style={styles.statBox}>
                    <Text style={[styles.statLabel, { color: DrawerTheme.woodLight }]}>스탬프</Text>
                    <Text style={styles.statValue}>{stats.current_stamps}/10</Text>
                </View>
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

            {/* Archive Mode Tabs */}
            <View style={[styles.tabContainer, { borderColor: DrawerTheme.woodFrame }]}>
                {[
                    { id: 'ON', label: 'ON', color: DrawerTheme.woodMid },
                    { id: 'OFF', label: 'OFF', color: DrawerTheme.navyMid },
                    { id: 'ALL', label: 'ALL', color: DrawerTheme.goldBrass }
                ].map((tab) => (
                    <TouchableOpacity
                        key={tab.id}
                        onPress={() => onSetArchiveMode(tab.id)}
                        style={[styles.tabButton, archiveMode === tab.id && { backgroundColor: tab.color, borderColor: DrawerTheme.goldBright }]}
                    >
                        <Text style={[styles.tabLabel, archiveMode === tab.id && styles.activeTabLabel]}>{tab.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: { alignItems: 'center', paddingTop: 20, marginBottom: 10 },
    title: { fontSize: 22, letterSpacing: 3, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Cochin' : 'serif' },
    brassBoard: { flexDirection: 'row', width: '92%', marginTop: 10, padding: 10, borderRadius: 8, borderWidth: 2, elevation: 10 },
    statBox: { alignItems: 'center', flex: 1 },
    statLabel: { fontSize: 9, marginBottom: 2, fontWeight: 'bold' },
    statValue: { fontSize: 16, color: '#FFF', fontWeight: 'bold' },
    divider: { width: 1, height: 25 },
    tabContainer: { flexDirection: 'row', width: '92%', height: 38, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, marginTop: 10, padding: 3, borderWidth: 1 },
    tabButton: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
    tabLabel: { color: '#888', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
    activeTabLabel: { color: '#FFF' },
});
