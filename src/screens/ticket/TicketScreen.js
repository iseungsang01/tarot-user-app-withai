import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CouponCard, CellarMark, PremiumCard, PremiumHeaderPanel, ScreenContainer } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { couponService } from '../../services/couponService';
import { handleApiCall } from '../../utils/errorHandler';

const MAX_STAMPS = 10;

const getCouponType = (code) => (code?.startsWith('BIRTHDAY') || code?.startsWith('BIRTH') ? 'birthday' : 'stamp');

const TicketScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { customer, refreshCustomer } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const currentStamps = Math.max(0, Math.min(Number(customer?.current_stamps) || 0, MAX_STAMPS));
  const stampCoupons = useMemo(() => coupons.filter((coupon) => getCouponType(coupon.coupon_code) === 'stamp'), [coupons]);
  const birthdayCoupons = useMemo(() => coupons.filter((coupon) => getCouponType(coupon.coupon_code) === 'birthday'), [coupons]);

  const loadTickets = useCallback(async () => {
    if (!customer?.id) return;
    const { data, error } = await handleApiCall('TicketScreen.loadTickets', () => couponService.getCoupons(customer.id));
    if (!error && data) setCoupons(data);
  }, [customer?.id]);

  useFocusEffect(
    useCallback(() => {
      loadTickets();
    }, [loadTickets])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadTickets(), refreshCustomer?.()]);
    setRefreshing(false);
  };

  const handleCouponPress = () => {
    navigation.navigate('Coupon');
  };

  return (
    <ScreenContainer safeTop={false} safeBottom={false}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 108 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={DrawerTheme.goldBrass} />}
        showsVerticalScrollIndicator={false}
      >
      <PremiumHeaderPanel title="TICKET LEDGER" subtitle="스탬프와 쿠폰을 한눈에 확인하세요" compact>

        <View style={styles.summaryRow}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryValue}>{coupons.length}</Text>
            <Text style={styles.summaryLabel}>COUPONS</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryValue}>{currentStamps}/{MAX_STAMPS}</Text>
            <Text style={styles.summaryLabel}>STAMPS</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryValue}>{birthdayCoupons.length}</Text>
            <Text style={styles.summaryLabel}>BONUS</Text>
          </View>
        </View>
      </PremiumHeaderPanel>

      <PremiumCard variant="walnut" style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>STAMP CARD</Text>
          <Text style={styles.panelMeta}>{MAX_STAMPS - currentStamps > 0 ? `다음 보상까지 ${MAX_STAMPS - currentStamps}개 남았습니다` : '보상 봉인 해제 가능'}</Text>
        </View>
        <View style={styles.stampGrid}>
          {Array.from({ length: MAX_STAMPS }).map((_, index) => {
            const filled = index < currentStamps;
            return (
              <View key={`stamp-${index}`} style={[styles.stampSlot, filled && styles.stampSlotFilled]}>
                <CellarMark size={filled ? 42 : 36} filled={filled} />
                <Text style={[styles.stampNumber, filled && styles.stampNumberFilled]}>{String(index + 1).padStart(2, '0')}</Text>
              </View>
            );
          })}
        </View>
      </PremiumCard>

      <PremiumCard style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>OWNED COUPONS</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Coupon')}>
            <Text style={styles.detailLink}>DETAIL</Text>
          </TouchableOpacity>
        </View>

        {coupons.length === 0 ? (
          <View style={styles.emptyEnvelope}>
            <View style={styles.envelopeFlap} />
            <CellarMark size={44} />
            <Text style={styles.emptyText}>아직 봉인된 쿠폰이 없습니다</Text>
          </View>
        ) : (
          coupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              type={getCouponType(coupon.coupon_code)}
              onPress={handleCouponPress}
            />
          ))
        )}
      </PremiumCard>

      {stampCoupons.length > 0 && (
        <Text style={styles.footerHint}>{stampCoupons.length} stamp reward coupon{stampCoupons.length > 1 ? 's' : ''} available.</Text>
      )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    width: '100%',
  },
  summaryChip: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.24)',
    borderRadius: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    alignItems: 'center',
  },
  summaryValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  summaryLabel: {
    color: DrawerTheme.woodLight,
    fontSize: 9,
    marginTop: 2,
    letterSpacing: 0.8,
  },
  panel: {
    marginTop: 12,
    marginBottom: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  panelTitle: {
    color: DrawerTheme.goldBrass,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  panelMeta: {
    color: DrawerTheme.woodLight,
    fontSize: 11,
    opacity: 0.8,
  },
  stampGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  stampSlot: {
    width: '18.4%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.28)',
    backgroundColor: 'rgba(7,0,9,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampSlotFilled: {
    borderColor: DrawerTheme.brightGold,
    backgroundColor: 'rgba(200,163,64,0.1)',
  },
  stampNumber: {
    position: 'absolute',
    bottom: 5,
    color: DrawerTheme.mutedGold,
    fontSize: 8,
    fontWeight: '900',
  },
  stampNumberFilled: {
    color: DrawerTheme.bgBlackCherry,
  },
  detailLink: {
    color: DrawerTheme.goldBrass,
    fontSize: 11,
    fontWeight: '900',
  },
  emptyEnvelope: {
    minHeight: 134,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.28)',
    backgroundColor: 'rgba(31,18,12,0.46)',
    overflow: 'hidden',
    gap: 10,
  },
  envelopeFlap: {
    position: 'absolute',
    top: -54,
    width: '80%',
    height: 110,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.16)',
    backgroundColor: 'rgba(18,0,8,0.28)',
  },
  emptyText: {
    color: DrawerTheme.ivory,
    fontSize: 13,
    fontWeight: '700',
  },
  footerHint: {
    color: DrawerTheme.woodLight,
    fontSize: 11,
    textAlign: 'center',
    opacity: 0.75,
  },
});

export default TicketScreen;
