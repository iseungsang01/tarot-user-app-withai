import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { GradientBackground } from '../components/GradientBackground';
import { Colors } from '../constants/Colors';
import { DrawerTheme } from '../constants/DrawerTheme';

// Import Screen Contents (We will adapt these)
import NoticeScreen from './NoticeScreen';
import VoteScreen from './VoteScreen';
import CouponScreen from './CouponScreen';

const ShopContentsScreen = ({ route, navigation }) => {
    const { shop } = route.params;
    const [activeTab, setActiveTab] = useState('notice');

    const tabs = [
        { id: 'notice', label: '소식', emoji: '📢' },
        { id: 'vote', label: '투표', emoji: '🗳️' },
        { id: 'coupon', label: '쿠폰', emoji: '🎟️' },
    ];

    return (
        <GradientBackground>
            <View style={styles.container}>
                {/* Shop Header */}
                <View style={styles.shopHeader}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backText}>❮ 목록</Text>
                    </TouchableOpacity>
                    <Text style={styles.shopName}>{shop.name}</Text>
                    <View style={{ width: 60 }} />
                </View>

                {/* Tab Bar */}
                <View style={styles.tabBar}>
                    {tabs.map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[
                                styles.tabItem,
                                activeTab === tab.id && styles.activeTabItem
                            ]}
                            onPress={() => setActiveTab(tab.id)}
                        >
                            <Text style={[
                                styles.tabEmoji,
                                activeTab === tab.id && styles.activeTabText
                            ]}>{tab.emoji}</Text>
                            <Text style={[
                                styles.tabLabel,
                                activeTab === tab.id && styles.activeTabText
                            ]}>{tab.label}</Text>
                            {activeTab === tab.id && <View style={styles.activeIndicator} />}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Content Area */}
                <View style={styles.contentArea}>
                    {activeTab === 'notice' && <NoticeScreen isIntegrated={true} />}
                    {activeTab === 'vote' && <VoteScreen isIntegrated={true} />}
                    {activeTab === 'coupon' && <CouponScreen isIntegrated={true} />}
                </View>
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    shopHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 15,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    backButton: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    backText: {
        color: '#FFF',
        fontSize: 14,
    },
    shopName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.gold,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212, 175, 55, 0.2)',
    },
    tabItem: {
        flex: 1,
        paddingVertical: 15,
        alignItems: 'center',
        position: 'relative',
    },
    activeTabItem: {
        // backgroundColor: 'rgba(212, 175, 55, 0.05)',
    },
    tabEmoji: {
        fontSize: 18,
        marginBottom: 4,
        opacity: 0.6,
    },
    tabLabel: {
        fontSize: 12,
        color: DrawerTheme.woodLight,
        opacity: 0.6,
    },
    activeTabText: {
        opacity: 1,
        color: Colors.gold,
        fontWeight: 'bold',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 0,
        width: '40%',
        height: 3,
        backgroundColor: Colors.gold,
        borderRadius: 1.5,
    },
    contentArea: {
        flex: 1,
    }
});

export default ShopContentsScreen;
