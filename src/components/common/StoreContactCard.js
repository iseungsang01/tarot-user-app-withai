import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PremiumCard } from './PremiumUI';
import { STORE_INFO } from '../../constants/Config';
import { DrawerTheme } from '../../constants/DrawerTheme';

const openLink = async (url) => {
    try {
        await Linking.openURL(url);
    } catch {
        Alert.alert('링크를 열 수 없습니다', '잠시 후 다시 시도해 주세요.');
    }
};

/**
 * 매장 연락 카드. 앱의 "매장에 문의해주세요" 안내가 닿을 곳.
 * Config 의 STORE_INFO 에 값이 있는 줄만 그린다.
 */
export const StoreContactCard = ({ title = '매장 정보', style }) => (
    <PremiumCard variant="walnut" style={style}>
        <Text style={styles.label}>{title}</Text>
        <Text style={styles.name}>{STORE_INFO.name}</Text>

        {!!STORE_INFO.address && <Text style={styles.detail}>{STORE_INFO.address}</Text>}
        {!!STORE_INFO.hours && <Text style={styles.detail}>{STORE_INFO.hours}</Text>}

        <View style={styles.actionRow}>
            {!!STORE_INFO.phone && (
                <StoreAction label="전화" onPress={() => openLink(`tel:${STORE_INFO.phone}`)} primary />
            )}
            {!!STORE_INFO.reservationUrl && (
                <StoreAction label="예약하기" onPress={() => openLink(STORE_INFO.reservationUrl)} primary={!STORE_INFO.phone} />
            )}
            {!!STORE_INFO.mapUrl && (
                <StoreAction label="길찾기" onPress={() => openLink(STORE_INFO.mapUrl)} />
            )}
        </View>
    </PremiumCard>
);

const StoreAction = ({ label, onPress, primary = false }) => (
    <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${STORE_INFO.name} ${label}`}
        activeOpacity={0.84}
        onPress={onPress}
        style={[styles.action, primary && styles.actionPrimary]}
    >
        <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    label: {
        color: DrawerTheme.goldBrass,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.2,
    },
    name: {
        marginTop: 6,
        color: DrawerTheme.ivory,
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    detail: {
        marginTop: 4,
        color: DrawerTheme.mutedIvory,
        fontSize: 13,
        lineHeight: 19,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 14,
    },
    action: {
        flex: 1,
        minHeight: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(224,184,90,0.32)',
        backgroundColor: 'rgba(244,232,208,0.06)',
    },
    actionPrimary: {
        borderColor: DrawerTheme.brassHighlight,
        backgroundColor: 'rgba(184,135,53,0.22)',
    },
    actionText: {
        color: DrawerTheme.mutedIvory,
        fontSize: 13,
        fontWeight: '800',
    },
    actionTextPrimary: {
        color: DrawerTheme.brightGold,
    },
});
