import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image, Alert, Keyboard, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CouponCard, CellarMark, PremiumCard, PremiumHeaderPanel, ScreenContainer } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { couponService } from '../../services/couponService';
import { createValidationError, handleApiCall, showErrorAlert, showSuccessAlert } from '../../utils/errorHandler';

const MAX_STAMPS = 10;

const tarotCards = [
  { name: 'The Fool', image: require('../../../assets/card/0. The Fool.png') },
  { name: 'The Magician', image: require('../../../assets/card/1. The Magician.png') },
  { name: 'The High Priestess', image: require('../../../assets/card/2. The High Priestess.png') },
  { name: 'The Empress', image: require('../../../assets/card/3. The Empress.png') },
  { name: 'The Emperor', image: require('../../../assets/card/4. The Emperor.png') },
  { name: 'The Hierophant', image: require('../../../assets/card/5. The Hierophant.png') },
  { name: 'The Lovers', image: require('../../../assets/card/6. The Lovers.png') },
  { name: 'The Chariot', image: require('../../../assets/card/7. Chariot.png') },
  { name: 'Strength', image: require('../../../assets/card/8. Strength.png') },
  { name: 'The Hermit', image: require('../../../assets/card/9. The Hermit.png') },
];

const getCouponType = (code) => (code?.startsWith('BIRTHDAY') || code?.startsWith('BIRTH') ? 'birthday' : 'stamp');

const TicketScreen = () => {
  const insets = useSafeAreaInsets();
  const { customer, refreshCustomer } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState(null);
  const [password, setPassword] = useState('');
  const [processingCouponId, setProcessingCouponId] = useState(null);
  const passwordInputRef = useRef(null);

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
      refreshCustomer?.();
    }, [loadTickets, refreshCustomer])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadTickets(), refreshCustomer?.()]);
    setRefreshing(false);
  };

  const resetCouponUse = () => {
    Keyboard.dismiss();
    setSelectedCouponId(null);
    setPassword('');
  };

  const handleCouponPress = (coupon) => {
    if (selectedCouponId === coupon.id) {
      resetCouponUse();
      return;
    }

    setSelectedCouponId(coupon.id);
    setPassword('');
    setTimeout(() => passwordInputRef.current?.focus(), 120);
  };

  const handleUseCoupon = async (coupon) => {
    if (!password.trim()) {
      showErrorAlert(createValidationError('PASSWORD_EMPTY'), Alert);
      return;
    }

    Keyboard.dismiss();

    Alert.alert('쿠폰 사용', '이 쿠폰을 사용 처리하시겠습니까?', [
      {
        text: '취소',
        style: 'cancel',
      },
      {
        text: '사용',
        onPress: async () => {
          setProcessingCouponId(coupon.id);
          const { error } = await handleApiCall('TicketScreen.useCoupon', () => couponService.useCoupon(coupon.id, password));
          if (!error) {
            showSuccessAlert('COUPON_USED', Alert, '쿠폰이 사용 처리되었습니다.');
            resetCouponUse();
            await Promise.all([loadTickets(), refreshCustomer?.()]);
          } else if (error.code === 'INVALID_ADMIN_PASSWORD') {
            Alert.alert('인증 실패', '관리자 비밀번호가 일치하지 않습니다.');
          } else {
            Alert.alert('쿠폰 사용 실패', error.message || '쿠폰 사용 처리 중 문제가 발생했습니다.');
          }
          setProcessingCouponId(null);
        },
      },
    ]);
  };

  return (
    <ScreenContainer safeTop={false} safeBottom={false}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 108 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={DrawerTheme.goldBrass} />}
        showsVerticalScrollIndicator={false}
      >
      <PremiumHeaderPanel title="STAMP & COUPON" subtitle="스탬프와 쿠폰을 한눈에 확인하세요" compact>

        <View style={styles.summaryRow}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryValue}>{coupons.length}</Text>
            <Text style={styles.summaryLabel}>쿠폰</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryValue}>{currentStamps}/{MAX_STAMPS}</Text>
            <Text style={styles.summaryLabel}>스탬프</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryValue}>{birthdayCoupons.length}</Text>
            <Text style={styles.summaryLabel}>생일</Text>
          </View>
        </View>
      </PremiumHeaderPanel>

      <PremiumCard variant="walnut" style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>스탬프 카드</Text>
          <Text style={styles.panelMeta}>{MAX_STAMPS - currentStamps > 0 ? `다음 보상까지 ${MAX_STAMPS - currentStamps}개 남았습니다` : '쿠폰을 받을 수 있습니다'}</Text>
        </View>
        <View style={styles.stampGrid}>
          {tarotCards.map((card, index) => {
            const filled = index < currentStamps;
            return (
              <View key={card.name} style={[styles.stampSlot, filled && styles.stampSlotFilled]}>
                <Image
                  source={card.image}
                  style={[styles.stampCardImage, !filled && styles.stampCardImageLocked]}
                  resizeMode="cover"
                />
                {!filled && <View style={styles.lockedOverlay} />}
                <View style={[styles.stampNumberBadge, filled && styles.stampNumberBadgeFilled]}>
                  <Text style={[styles.stampNumber, filled && styles.stampNumberFilled]}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </PremiumCard>

      <PremiumCard style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>보유 쿠폰</Text>
        </View>

        {coupons.length === 0 ? (
          <View style={styles.emptyEnvelope}>
            <View style={styles.envelopeFlap} />
            <CellarMark size={44} />
            <Text style={styles.emptyText}>보유한 쿠폰이 없습니다</Text>
          </View>
        ) : (
          coupons.map((coupon) => {
            const isSelected = selectedCouponId === coupon.id;
            const isProcessing = processingCouponId === coupon.id;

            return (
              <View key={coupon.id} style={styles.couponUseBlock}>
                <CouponCard
                  coupon={coupon}
                  type={getCouponType(coupon.coupon_code)}
                  onPress={handleCouponPress}
                  containerStyle={isSelected ? styles.selectedCoupon : null}
                />
                {isSelected && (
                  <View style={styles.inlineUseForm}>
                    <Text style={styles.inlineUseTitle}>관리자 비밀번호를 입력하면 바로 사용할 수 있습니다.</Text>
                    <TextInput
                      ref={passwordInputRef}
                      style={styles.passwordInput}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="관리자 비밀번호"
                      placeholderTextColor="rgba(255,255,255,0.32)"
                      secureTextEntry
                      autoCapitalize="none"
                      onSubmitEditing={() => handleUseCoupon(coupon)}
                      editable={!isProcessing}
                    />
                    <View style={styles.inlineButtons}>
                      <TouchableOpacity
                        activeOpacity={0.84}
                        style={[styles.inlineButton, styles.useButton]}
                        onPress={() => handleUseCoupon(coupon)}
                        disabled={isProcessing}
                      >
                        <Text style={styles.useButtonText}>{isProcessing ? '처리 중...' : '사용하기'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.84}
                        style={[styles.inlineButton, styles.cancelButton]}
                        onPress={resetCouponUse}
                        disabled={isProcessing}
                      >
                        <Text style={styles.cancelButtonText}>취소</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </PremiumCard>

      {stampCoupons.length > 0 && (
        <Text style={styles.footerHint}>스탬프 쿠폰 {stampCoupons.length}개를 사용할 수 있습니다.</Text>
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
    aspectRatio: 0.68,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.32)',
    backgroundColor: 'rgba(7,0,9,0.5)',
    overflow: 'hidden',
  },
  stampSlotFilled: {
    borderColor: DrawerTheme.brightGold,
    borderWidth: 1.5,
    shadowColor: DrawerTheme.brightGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  stampCardImage: {
    width: '100%',
    height: '100%',
  },
  stampCardImageLocked: {
    opacity: 0.34,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,0,14,0.56)',
  },
  stampNumberBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    minWidth: 19,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.26)',
  },
  stampNumberBadgeFilled: {
    backgroundColor: 'rgba(245,210,103,0.88)',
    borderColor: DrawerTheme.brightGold,
  },
  stampNumber: {
    color: DrawerTheme.mutedGold,
    fontSize: 8,
    fontWeight: '900',
  },
  stampNumberFilled: {
    color: DrawerTheme.bgBlackCherry,
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
  couponUseBlock: {
    marginBottom: 10,
  },
  selectedCoupon: {
    borderColor: DrawerTheme.goldBrass,
    borderWidth: 1.5,
  },
  inlineUseForm: {
    marginTop: -8,
    marginHorizontal: 4,
    padding: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(200,163,64,0.34)',
    backgroundColor: 'rgba(18,0,8,0.9)',
  },
  inlineUseTitle: {
    color: DrawerTheme.ivory,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  passwordInput: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.28)',
    backgroundColor: 'rgba(0,0,0,0.34)',
    color: DrawerTheme.goldBright,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  inlineButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useButton: {
    backgroundColor: DrawerTheme.goldBrass,
  },
  useButtonText: {
    color: DrawerTheme.bgBlackCherry,
    fontSize: 13,
    fontWeight: '900',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cancelButtonText: {
    color: DrawerTheme.mutedIvory,
    fontSize: 13,
    fontWeight: '800',
  },
});

export default TicketScreen;
