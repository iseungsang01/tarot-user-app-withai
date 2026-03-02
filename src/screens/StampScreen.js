import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { GradientBackground } from '../components/common/GradientBackground';
import { DrawerTheme } from '../constants/DrawerTheme';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';

const tarotCards = [
  { emoji: '🃏', name: 'The Fool' },
  { emoji: '🎩', name: 'The Magician' },
  { emoji: '👸', name: 'The Empress' },
  { emoji: '🤴', name: 'The Emperor' },
  { emoji: '⚖️', name: 'Justice' },
  { emoji: '🌙', name: 'The Moon' },
  { emoji: '☀️', name: 'The Sun' },
  { emoji: '⭐', name: 'The Star' },
  { emoji: '🎭', name: 'The Lovers' },
  { emoji: '🔱', name: 'The Devil' }
];

const MAX_STAMPS = 10;

const StampScreen = () => {
  const { customer, refreshCustomer } = useAuth();
  const [showStampInput, setShowStampInput] = useState(false);
  const [showEditStamp, setShowEditStamp] = useState(false);
  const [stampCount, setStampCount] = useState('1');
  const [editStampValue, setEditStampValue] = useState('0');
  const [currentCustomer, setCurrentCustomer] = useState(customer);
  const [localMessage, setLocalMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    setCurrentCustomer(customer);
    setEditStampValue(String(customer?.current_stamps || 0));
  }, [customer]);

  const showLocalMessage = (text, type = 'success') => {
    setLocalMessage({ text, type });
    setTimeout(() => setLocalMessage({ text: '', type: '' }), 3000);
  };

  const currentStamps = useMemo(() => currentCustomer?.current_stamps || 0, [currentCustomer]);

  const syncCustomer = async () => {
    await refreshCustomer();
  };

  const addStamp = async () => {
    if (!currentCustomer || currentCustomer.isGuest) {
      Alert.alert('안내', '게스트 모드에서는 스탬프를 적립할 수 없습니다.');
      return;
    }

    const count = parseInt(stampCount, 10) || 1;

    if (count < 1 || count > MAX_STAMPS) {
      Alert.alert('오류', '스탬프는 1~10개 사이로 입력해주세요.');
      return;
    }

    if (currentStamps >= MAX_STAMPS) {
      Alert.alert('오류', '이미 10개가 모두 찍혔습니다! 쿠폰을 발급해주세요.');
      return;
    }

    const actualCount = Math.min(count, MAX_STAMPS - currentStamps);
    const newCurrentStamps = currentStamps + actualCount;

    const { error: historyError } = await supabase
      .from('visit_history')
      .insert([{ customer_id: currentCustomer.id }]);

    if (historyError) {
      Alert.alert('오류', historyError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from('customers')
      .update({
        current_stamps: newCurrentStamps,
        total_stamps: (currentCustomer.total_stamps || 0) + actualCount,
        visit_count: (currentCustomer.visit_count || 0) + 1,
        last_visit: new Date().toISOString()
      })
      .eq('id', currentCustomer.id);

    if (updateError) {
      Alert.alert('오류', updateError.message);
      return;
    }

    setShowStampInput(false);
    setStampCount('1');
    await syncCustomer();

    if (newCurrentStamps === MAX_STAMPS) {
      showLocalMessage('🌟 모든 카드를 모았습니다! 운명의 쿠폰을 받으세요!', 'success');
    } else {
      showLocalMessage(`✅ 스탬프 ${actualCount}개가 추가되었습니다.`, 'success');
    }
  };

  const editStampCount = async () => {
    if (!currentCustomer || currentCustomer.isGuest) return;

    const newCount = parseInt(editStampValue, 10);
    if (Number.isNaN(newCount) || newCount < 0 || newCount > MAX_STAMPS) {
      Alert.alert('오류', '스탬프는 0~10개 사이로 입력해주세요.');
      return;
    }

    const stampDifference = newCount - currentStamps;

    const { error } = await supabase
      .from('customers')
      .update({
        current_stamps: newCount,
        total_stamps: (currentCustomer.total_stamps || 0) + stampDifference
      })
      .eq('id', currentCustomer.id);

    if (error) {
      Alert.alert('오류', error.message);
      return;
    }

    setShowEditStamp(false);
    await syncCustomer();
    showLocalMessage(`✅ 스탬프가 ${newCount}개로 수정되었습니다.`, 'success');
  };

  const issueCoupon = async () => {
    if (!currentCustomer || currentCustomer.isGuest) return;

    if (currentStamps < MAX_STAMPS) {
      Alert.alert('오류', '스탬프 10개를 모두 모아야 합니다.');
      return;
    }

    const couponCode = `COUPON${Date.now().toString().slice(-8)}`;

    const { error: couponError } = await supabase
      .from('coupon_history')
      .insert([{ customer_id: currentCustomer.id, coupon_code: couponCode }]);

    if (couponError) {
      Alert.alert('오류', couponError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from('customers')
      .update({
        current_stamps: 0,
        coupons: (currentCustomer.coupons || 0) + 1
      })
      .eq('id', currentCustomer.id);

    if (updateError) {
      Alert.alert('오류', updateError.message);
      return;
    }

    await syncCustomer();
    showLocalMessage(`🎴 운명의 쿠폰이 발급되었습니다!\n쿠폰 코드: ${couponCode}`, 'success');
  };

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.wrapper}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.nick}>{currentCustomer?.nickname || '고객'}</Text>
              <Text style={styles.phone}>{currentCustomer?.phone_number || '전화번호 없음'}</Text>
            </View>
            <View>
              <Text style={styles.infoText}>카드: <Text style={styles.bold}>{currentStamps}/10</Text></Text>
              <Text style={styles.infoText}>방문: <Text style={styles.bold}>{currentCustomer?.visit_count || 0}회</Text></Text>
            </View>
          </View>

          <View style={styles.stampGrid}>
            {Array.from({ length: MAX_STAMPS }).map((_, i) => {
              const filled = i < currentStamps;
              return (
                <View key={`stamp-${i}`} style={[styles.stamp, filled ? styles.filled : styles.empty]}>
                  <Text style={styles.stampEmoji}>{filled ? tarotCards[i].emoji : '✧'}</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.visitInfo}>
            최근 방문: {currentCustomer?.last_visit ? new Date(currentCustomer.last_visit).toLocaleString('ko-KR') : '기록 없음'}
          </Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.btn, styles.btnSuccess]} onPress={() => { setShowStampInput(!showStampInput); setShowEditStamp(false); }}>
              <Text style={styles.btnText}>✔ 스탬프</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnInfo]} onPress={() => { setShowEditStamp(!showEditStamp); setShowStampInput(false); }}>
              <Text style={styles.btnText}>✏️ 수정</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnWarn, currentStamps < MAX_STAMPS && styles.disabled]} disabled={currentStamps < MAX_STAMPS} onPress={issueCoupon}>
              <Text style={styles.btnText}>🎁 쿠폰</Text>
            </TouchableOpacity>
          </View>

          {showStampInput && (
            <View style={styles.inlineForm}>
              <TextInput value={stampCount} onChangeText={setStampCount} keyboardType="number-pad" style={styles.input} />
              <TouchableOpacity style={[styles.btn, styles.btnSuccess]} onPress={addStamp}><Text style={styles.btnText}>추가</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnWarn]} onPress={() => setShowStampInput(false)}><Text style={styles.btnText}>취소</Text></TouchableOpacity>
            </View>
          )}

          {showEditStamp && (
            <View style={styles.inlineForm}>
              <TextInput value={editStampValue} onChangeText={setEditStampValue} keyboardType="number-pad" style={styles.input} />
              <TouchableOpacity style={[styles.btn, styles.btnSuccess]} onPress={editStampCount}><Text style={styles.btnText}>수정</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnWarn]} onPress={() => setShowEditStamp(false)}><Text style={styles.btnText}>취소</Text></TouchableOpacity>
            </View>
          )}

          {!!localMessage.text && (
            <View style={[styles.message, localMessage.type === 'error' ? styles.messageError : styles.messageSuccess]}>
              <Text style={styles.messageText}>{localMessage.text}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  wrapper: { padding: 16, paddingBottom: 120 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', backgroundColor: 'rgba(18,10,36,0.85)', padding: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  nick: { color: DrawerTheme.goldBright, fontSize: 18, fontWeight: '700' },
  phone: { color: '#ddd', marginTop: 2, fontSize: 12 },
  infoText: { color: '#f4f4f4', fontSize: 12, textAlign: 'right' },
  bold: { fontWeight: '700', color: '#fff' },
  stampGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  stamp: { width: '18%', aspectRatio: 1, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filled: { backgroundColor: 'rgba(212,175,55,0.18)', borderColor: DrawerTheme.goldBrass },
  empty: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.2)' },
  stampEmoji: { fontSize: 20 },
  visitInfo: { color: '#ddd', fontSize: 12, marginBottom: 12 },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  inlineForm: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  input: { flex: 1.3, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: DrawerTheme.goldBrass, paddingHorizontal: 10, paddingVertical: 9 },
  btn: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  btnSuccess: { backgroundColor: '#2e8b57' },
  btnInfo: { backgroundColor: '#3567c7' },
  btnWarn: { backgroundColor: '#b5832f' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  disabled: { opacity: 0.45 },
  message: { marginTop: 4, borderRadius: 8, padding: 10 },
  messageSuccess: { backgroundColor: 'rgba(46,139,87,0.3)' },
  messageError: { backgroundColor: 'rgba(196,62,62,0.3)' },
  messageText: { color: '#fff', fontSize: 13 }
});

export default StampScreen;
