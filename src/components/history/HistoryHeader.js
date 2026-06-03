import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { PremiumHeaderPanel } from '../common/PremiumUI';

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
            <PremiumHeaderPanel title="DRAWER ARCHIVE" subtitle="봉인된 카드 기록을 확인하세요" compact>
                <View style={styles.statsContainer}>
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
                </View>
            </PremiumHeaderPanel>
        </View>
    );
};

const serif = Platform.OS === 'ios' ? 'Cochin' : 'serif';

const styles = StyleSheet.create({
    wrap: {
        width: '100%',
        alignItems: 'center',
        paddingBottom: 12,
    },
    statsContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 68,
        borderRadius: 14,
        paddingVertical: 10,
        marginTop: 14,
        borderWidth: 1,
        borderColor: 'rgba(244,232,208,0.08)',
        backgroundColor: 'rgba(7,0,9,0.34)',
        overflow: 'hidden',
    },
    statUnit: {
        alignItems: 'center',
        flex: 1,
        minHeight: 48,
        justifyContent: 'center',
    },
    statLabel: {
        fontSize: 11,
        marginBottom: 5,
        fontWeight: '600',
        color: DrawerTheme.mutedIvory,
        fontFamily: serif,
        letterSpacing: 0.3,
    },
    statValue: {
        fontSize: 20,
        color: DrawerTheme.ivory,
        fontWeight: '700',
        fontFamily: serif,
    },
    goldValue: {
        color: DrawerTheme.brightGold,
    },
    divider: {
        width: 1,
        height: 38,
        backgroundColor: 'rgba(200,163,64,0.14)',
    },
});
