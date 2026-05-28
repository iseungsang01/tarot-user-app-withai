import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CommonStyles } from '../../styles/CommonStyles';
import { CouponCard } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { couponService } from '../../services/couponService';
import { handleApiCall } from '../../utils/errorHandler';

const MAX_STAMPS = 10;

const STAMP_IMAGES = [
  require('../../../assets/card/0. The Fool.png'),
  require('../../../assets/card/1. The Magician.png'),
  require('../../../assets/card/2. The High Priestess.png'),
  require('../../../assets/card/3. The Empress.png'),
  require('../../../assets/card/4. The Emperor.png'),
  require('../../../assets/card/5. The Hierophant.png'),
  require('../../../assets/card/6. The Lovers.png'),
  require('../../../assets/card/7. Chariot.png'),
  require('../../../assets/card/8. Strength.png'),
  require('../../../assets/card/9. The Hermit.png'),
];

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={DrawerTheme.goldBrass} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>TICKET</Text>
        </View>
        <View style={styles.headerDivider} />
        <Text style={styles.subtitle}>Coupons and stamps at a glance</Text>

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
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>STAMP CARDS</Text>
          <Text style={styles.panelMeta}>{MAX_STAMPS - currentStamps > 0 ? `${MAX_STAMPS - currentStamps} left` : 'reward ready'}</Text>
        </View>
        <View style={styles.stampGrid}>
          {STAMP_IMAGES.map((source, index) => {
            const filled = index < currentStamps;
            return (
              <View key={`stamp-${index}`} style={[styles.stampSlot, filled && styles.stampSlotFilled]}>
                <Image source={source} style={[styles.stampImage, !filled && styles.stampImageEmpty]} resizeMode="cover" />
                {!filled && <View style={styles.emptyOverlay}><Text style={styles.emptyIndex}>{index + 1}</Text></View>}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>OWNED COUPONS</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Coupon')}>
            <Text style={styles.detailLink}>DETAIL</Text>
          </TouchableOpacity>
        </View>

        {coupons.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No coupons yet.</Text>
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
      </View>

      {stampCoupons.length > 0 && (
        <Text style={styles.footerHint}>{stampCoupons.length} stamp reward coupon{stampCoupons.length > 1 ? 's' : ''} available.</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DrawerTheme.bgBlackPurple,
  },
  content: {
    paddingHorizontal: 14,
  },
  header: {
    ...CommonStyles.headerBoard,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
  },
  titleRow: {
    ...CommonStyles.titleRow,
    marginBottom: 2,
  },
  title: {
    ...CommonStyles.title,
    fontSize: 18,
    letterSpacing: 2.5,
  },
  headerDivider: {
    ...CommonStyles.headerDivider,
    width: 36,
    marginVertical: 6,
  },
  subtitle: {
    ...CommonStyles.subtitle,
    fontSize: 11,
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
    backgroundColor: 'rgba(74,55,40,0.86)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.16)',
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
    rowGap: 6,
  },
  stampSlot: {
    width: '18%',
    aspectRatio: 0.68,
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  stampSlotFilled: {
    borderColor: DrawerTheme.goldBrass,
  },
  stampImage: {
    width: '100%',
    height: '100%',
  },
  stampImageEmpty: {
    opacity: 0.18,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  emptyIndex: {
    color: 'rgba(212,175,55,0.5)',
    fontSize: 14,
    fontWeight: '900',
  },
  detailLink: {
    color: DrawerTheme.goldBrass,
    fontSize: 11,
    fontWeight: '900',
  },
  emptyBox: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyText: {
    color: DrawerTheme.woodLight,
    fontSize: 12,
    opacity: 0.8,
  },
  footerHint: {
    color: DrawerTheme.woodLight,
    fontSize: 11,
    textAlign: 'center',
    opacity: 0.75,
  },
});

export default TicketScreen;
