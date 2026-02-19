import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, TouchableOpacity, RefreshControl, Platform, Keyboard } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { GradientBackground, LoadingSpinner, CouponCard } from '../components';
import { useAuth } from '../hooks/useAuth';
import { couponService } from '../services/couponService';
import { adminService } from '../services/adminService';
import { DrawerTheme } from '../constants/DrawerTheme';
import { handleApiCall, createValidationError, showErrorAlert, showSuccessAlert } from '../utils/errorHandler';
import { CommonStyles } from '../styles/CommonStyles';

const CouponScreen = ({ navigation }) => {
  const { customer, refreshCustomer } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState(null);
  const [password, setPassword] = useState('');
  const [processing, setProcessing] = useState(false);
  const passwordInputRef = useRef(null);

  const getCouponType = (code) => (code?.startsWith('BIRTHDAY') || code?.startsWith('BIRTH') ? 'birthday' : 'stamp');

  const loadCoupons = async () => {
    const { data, error } = await handleApiCall('CouponScreen.loadCoupons', () => couponService.getCoupons(customer.id));
    if (!error && data) setCoupons(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { loadCoupons(); }, []));

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCoupons(), refreshCustomer()]);
    setRefreshing(false);
  };

  const handleSelectCoupon = (coupon) => {
    if (selectedCouponId === coupon.id) {
      handleCancelUse();
    } else {
      setSelectedCouponId(coupon.id);
      setPassword('');
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  };

  const handleCancelUse = () => {
    Keyboard.dismiss();
    setSelectedCouponId(null);
    setPassword('');
  };

  const handleUseCoupon = async (coupon) => {
    if (!password.trim()) {
      showErrorAlert(createValidationError('PASSWORD_EMPTY'), Alert);
      return;
    }

    setProcessing(true);
    const { data: success, error: verifyError } = await handleApiCall('CouponScreen.verifyPassword', () => adminService.verifyPassword(password));

    if (verifyError || !success) {
      setProcessing(false);
      Alert.alert('인증 실패', '관리자 비밀번호가 일치하지 않습니다.');
      return;
    }
    setProcessing(false);

    Keyboard.dismiss();
    const typeNm = getCouponType(coupon.coupon_code) === 'birthday' ? '생일 쿠폰' : '스탬프 쿠폰';

    Alert.alert('쿠폰 사용', `${typeNm}을 사용하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '사용 확정', onPress: async () => {
          setProcessing(true);
          const { error } = await handleApiCall('CouponScreen.handleUseCoupon', () => couponService.useCoupon(coupon.id));
          if (!error) {
            showSuccessAlert('COUPON_USED', Alert, `✅ ${typeNm}이 사용되었습니다!`);
            handleCancelUse();
            await Promise.all([loadCoupons(), refreshCustomer()]);
          }
          setProcessing(false);
        }
      }
    ]);
  };

  const renderCouponItem = (coupon) => {
    const isSelected = selectedCouponId === coupon.id;
    const type = getCouponType(coupon.coupon_code);
    const couponTitle = type === 'birthday' ? '🎂 생일 축하 쿠폰' : '⭐ 스탬프 완성 쿠폰';

    return (
      <View key={coupon.id} style={styles.couponWrapper}>
        <CouponCard
          coupon={coupon}
          type={type}
          onPress={() => handleSelectCoupon(coupon)}
          containerStyle={isSelected ? styles.selectedCard : null}
        />

        {isSelected && (
          <View style={styles.inlineForm}>
            <View style={styles.formHeader}>
              <Text style={styles.selectedCouponTitle}>{couponTitle}</Text>
              <Text style={styles.formLabel}>관리자 인증이 필요합니다</Text>
            </View>

            <TextInput
              ref={passwordInputRef}
              style={styles.inlineInput}
              value={password}
              onChangeText={setPassword}
              placeholder="관리자 비밀번호"
              placeholderTextColor="rgba(255,255,255,0.15)"
              secureTextEntry
              autoCapitalize="none"
              onSubmitEditing={() => handleUseCoupon(coupon)}
            />

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.btn, styles.submitBtn]}
                onPress={() => handleUseCoupon(coupon)}
                disabled={processing}
              >
                <Text style={styles.submitBtnText}>{processing ? '처리 중' : '사용 확정'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={handleCancelUse}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) return <GradientBackground><LoadingSpinner /></GradientBackground>;

  const stampCoupons = coupons.filter(c => getCouponType(c.coupon_code) === 'stamp');
  const birthdayCoupons = coupons.filter(c => getCouponType(c.coupon_code) === 'birthday');

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={styles.listArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={DrawerTheme.goldBrass} />}
      >
        {/* 🪵 NoticeScreen 규격과 100% 동일한 헤더 */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>COUPON BOX</Text>
          </View>
          <View style={styles.headerDivider} />
          <Text style={styles.subtitle}>{customer.nickname}님의 소중한 혜택</Text>

          {/* 통계 Row (헤더 내부 배치) */}
          <View style={styles.statsRow}>
            {[[coupons.length, '보유중'], [stampCoupons.length, '스탬프'], [birthdayCoupons.length, '기타']].map(([val, lab], i) => (
              <View key={i} style={styles.statBox}>
                <Text style={styles.statValue}>{val}</Text>
                <Text style={styles.statLabel}>{lab}</Text>
              </View>
            ))}
          </View>
        </View>

        {stampCoupons.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📜 스탬프 쿠폰</Text>
            {stampCoupons.map(renderCouponItem)}
          </View>
        )}

        {birthdayCoupons.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎁 생일 쿠폰</Text>
            {birthdayCoupons.map(renderCouponItem)}
          </View>
        )}

        {coupons.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🎫</Text>
            <Text style={styles.emptyText}>보유하신 쿠폰이 없습니다.</Text>
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 사용 안내</Text>
          <Text style={styles.infoText}>
            • 쿠폰을 탭하면 인증 화면이 나타납니다{'\n'}
            • 관리자에게 화면을 보여주세요{'\n'}
            • 스탬프 쿠폰: 스탬프 10개 모으면 쿠폰 1개 지급{'\n'}
            • 기타 쿠폰: 유효기간 내 1회 사용 가능
          </Text>
        </View>
      </ScrollView>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  // 🪵 NoticeScreen 규격 그대로 이식 (CommonStyles 사용)
  listArea: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 100
  },
  header: CommonStyles.headerBoard,
  titleRow: CommonStyles.titleRow,
  title: CommonStyles.title,
  headerDivider: CommonStyles.headerDivider,
  subtitle: {
    ...CommonStyles.subtitle,
    marginBottom: 20 // 통계 Row와의 간격
  },

  // 쿠폰 전용 통계 스타일
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(212,175,55,0.2)'
  },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  statLabel: { fontSize: 10, color: DrawerTheme.woodLight, marginTop: 2 },

  // 섹션 및 리스트
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: DrawerTheme.goldBrass, marginBottom: 15, marginLeft: 5 },
  couponWrapper: { marginBottom: 12 },
  selectedCard: { borderColor: DrawerTheme.goldBrass, borderWidth: 1.5 },

  // 비밀번호 입력 폼
  inlineForm: {
    backgroundColor: 'rgba(24, 22, 20, 0.98)',
    marginTop: -4, marginHorizontal: 4,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    padding: 18, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)', borderTopWidth: 0,
    elevation: 8
  },
  formHeader: { alignItems: 'center', marginBottom: 15 },
  selectedCouponTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  formLabel: { color: '#666', fontSize: 10 },
  inlineInput: {
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 14,
    color: DrawerTheme.goldBright, fontSize: 15, textAlign: 'center', marginBottom: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
  },
  formButtons: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 6, alignItems: 'center' },
  submitBtn: { backgroundColor: DrawerTheme.goldBrass },
  submitBtnText: { color: '#1A1A1A', fontWeight: 'bold', fontSize: 14 },
  cancelBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cancelBtnText: { color: '#777', fontSize: 14 },

  // 안내 및 빈 상태
  infoBox: { marginTop: 10, padding: 20, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.1)' },
  infoTitle: { color: DrawerTheme.woodLight, fontSize: 13, fontWeight: 'bold', marginBottom: 12 },
  infoText: { color: '#888', fontSize: 12, lineHeight: 20 },
  emptyBox: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 20, opacity: 0.3 },
  emptyText: { fontSize: 14, color: DrawerTheme.woodLight, fontStyle: 'italic', opacity: 0.7 }
});

export default CouponScreen;