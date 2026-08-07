import { View, Text, StyleSheet } from 'react-native';
import { ArchiveTitleHeader } from '../common/PremiumUI';
import { DrawerTheme } from '../../constants/DrawerTheme';

const MAX_STAMPS = 10;

export const HistoryHeader = ({ customer }) => {
    const stamps = Math.max(0, Math.min(Number(customer?.current_stamps) || 0, MAX_STAMPS));
    const left = MAX_STAMPS - stamps;

    return (
        <View style={styles.wrap}>
            <ArchiveTitleHeader
                eyebrow="PRIVATE TAROT CELLAR"
                title="DRAWER ARCHIVE"
                subtitle="서랍 기록 보관함"
            />
            {!customer?.isGuest && (
                <View style={styles.stampStrip}>
                    <View style={styles.stampBar}>
                        <View style={[styles.stampFill, { width: `${(stamps / MAX_STAMPS) * 100}%` }]} />
                    </View>
                    <Text style={styles.stampText}>
                        {left > 0 ? `스탬프 ${stamps}/${MAX_STAMPS} · ${left}개 남으면 쿠폰` : `스탬프 ${MAX_STAMPS}/${MAX_STAMPS} · 쿠폰을 받을 수 있어요`}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        width: '100%',
        alignItems: 'center',
        paddingBottom: 0,
        marginBottom: -6,
    },
    stampStrip: {
        width: '100%',
        marginTop: -4,
        marginBottom: 8,
        gap: 5,
    },
    stampBar: {
        width: '100%',
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: 'rgba(244,232,208,0.1)',
    },
    stampFill: {
        height: '100%',
        borderRadius: 2,
        backgroundColor: DrawerTheme.brassHighlight,
    },
    stampText: {
        color: DrawerTheme.mutedIvory,
        fontSize: 10.5,
        fontWeight: '800',
        letterSpacing: 0.2,
        textAlign: 'center',
        opacity: 0.86,
    },
});
