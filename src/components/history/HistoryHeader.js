import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LocalSvg } from 'react-native-svg/css';
import { DrawerTheme } from '../../constants/DrawerTheme';

const moonOrnamentAsset = require('../../../assets/tarot-cellar/ornament-moon.svg');

export const HistoryHeader = ({
    stats,
    couponCount,
    onNavigateCoupon,
    onNavigateStamp,
    onCoachAdvanceCoupon,
    onCoachAdvanceStamp,
    onCaptureStampFrame,
    onCaptureCouponFrame
}) => {
    const stampRef = useRef(null);
    const couponRef = useRef(null);

    const captureRefFrame = (ref, capture) => {
        if (!ref?.current || !capture) return;

        ref.current.measureInWindow((x, y, width, height) => {
            if (width > 0 && height > 0) capture({ x, y, width, height });
        });
    };

    return (
        <View style={styles.wrap}>
            <LocalSvg
                asset={moonOrnamentAsset}
                style={styles.titleOrnament}
                width={48}
                height={48}
            />

            <View style={styles.titleStack}>
                <Text style={styles.eyebrow}>SEALED RECORDS</Text>
                <Text style={styles.titleShadow}>DRAWER ARCHIVE</Text>
                <Text style={styles.title}>DRAWER ARCHIVE</Text>
                <Text style={styles.subtitle}>Card Drawer</Text>
            </View>

            <View style={styles.titleRule}>
                <View style={styles.ruleLine} />
                <View style={styles.ruleStar} />
                <View style={styles.ruleLine} />
            </View>

            <LinearGradient
                colors={['rgba(18,0,24,0.96)', 'rgba(34,5,31,0.92)', 'rgba(9,0,13,0.98)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statsContainer}
            >
                <View style={styles.cornerMark} />
                <TouchableOpacity
                    ref={stampRef}
                    style={styles.statUnit}
                    onPress={() => {
                        onNavigateStamp?.();
                        onCoachAdvanceStamp?.();
                    }}
                    onLayout={() => captureRefFrame(stampRef, onCaptureStampFrame)}
                    onPressIn={() => captureRefFrame(stampRef, onCaptureStampFrame)}
                >
                    <Text style={styles.statLabel}>스탬프</Text>
                    <Text style={styles.statValue}>{stats.current_stamps}/10</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
                <View style={styles.statUnit}>
                    <Text style={styles.statLabel}>방문 기록</Text>
                    <Text style={styles.statValue}>{stats.visit_count}</Text>
                </View>
                <View style={styles.divider} />
                <TouchableOpacity
                    ref={couponRef}
                    style={styles.statUnit}
                    onPress={() => {
                        onNavigateCoupon?.();
                        onCoachAdvanceCoupon?.();
                    }}
                    onLayout={() => captureRefFrame(couponRef, onCaptureCouponFrame)}
                    onPressIn={() => captureRefFrame(couponRef, onCaptureCouponFrame)}
                >
                    <Text style={styles.statLabel}>보유 쿠폰</Text>
                    <Text style={[styles.statValue, styles.goldValue]}>{couponCount}</Text>
                </TouchableOpacity>
                <View style={[styles.cornerMark, styles.cornerMarkRight]} />
            </LinearGradient>
        </View>
    );
};

const serif = Platform.OS === 'ios' ? 'Cochin' : 'serif';

const styles = StyleSheet.create({
    wrap: {
        width: '100%',
        alignItems: 'center',
        paddingTop: 0,
        paddingBottom: 10,
    },
    titleOrnament: {
        width: 48,
        height: 48,
        marginBottom: 4,
        opacity: 0.92,
        tintColor: DrawerTheme.brightGold,
    },
    titleStack: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    eyebrow: {
        color: DrawerTheme.mutedIvory,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 2.2,
        opacity: 0.76,
        marginBottom: 2,
    },
    titleShadow: {
        position: 'absolute',
        top: 20,
        color: '#4A2D12',
        fontFamily: serif,
        fontSize: 24,
        fontWeight: '700',
        letterSpacing: 2,
        opacity: 0.45,
    },
    title: {
        color: DrawerTheme.antiqueGold,
        fontFamily: serif,
        fontSize: 24,
        fontWeight: '700',
        letterSpacing: 2,
        textShadowColor: 'rgba(200,163,64,0.22)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 5,
    },
    subtitle: {
        marginTop: 2,
        color: DrawerTheme.mutedIvory,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
    },
    titleRule: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 5,
        marginBottom: 12,
    },
    ruleLine: {
        width: 94,
        height: 1,
        backgroundColor: 'rgba(184,135,53,0.58)',
    },
    ruleStar: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.46)',
        backgroundColor: 'rgba(224,184,90,0.18)',
    },
    statsContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.72)',
        minHeight: 96,
        borderRadius: 8,
        paddingVertical: 12,
        borderTopWidth: 2,
        borderBottomWidth: 2,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.34,
        shadowRadius: 12,
        elevation: 5,
    },
    statUnit: {
        alignItems: 'center',
        flex: 1,
        minHeight: 62,
        justifyContent: 'center',
    },
    statLabel: {
        fontSize: 11,
        marginBottom: 6,
        fontWeight: '700',
        color: DrawerTheme.antiqueGold,
        fontFamily: serif,
        letterSpacing: 0.5,
    },
    statValue: {
        fontSize: 29,
        color: DrawerTheme.ivory,
        fontWeight: '700',
        fontFamily: serif,
        textShadowColor: 'rgba(0,0,0,0.72)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 3,
    },
    goldValue: {
        color: DrawerTheme.brightGold,
    },
    divider: {
        width: 1,
        height: 70,
        backgroundColor: 'rgba(200,163,64,0.42)',
    },
    cornerMark: {
        position: 'absolute',
        left: 12,
        top: 10,
        width: 22,
        height: 22,
        borderLeftWidth: 1,
        borderTopWidth: 1,
        borderColor: 'rgba(224,184,90,0.58)',
    },
    cornerMarkRight: {
        left: undefined,
        right: 12,
        transform: [{ rotate: '90deg' }],
    },
});
