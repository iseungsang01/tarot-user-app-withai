import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { GradientBackground } from '../components/common/GradientBackground';
import { DrawerTheme } from '../constants/DrawerTheme';
import { CommonStyles } from '../styles/CommonStyles';
import { useAuth } from '../hooks/useAuth';

const tarotCards = [
  { emoji: '🃏', name: 'The Fool' },
  { emoji: '🎩', name: 'The Magician' },
  { emoji: '👸', name: 'The Empress' },
  { emoji: '🤴', name: 'The Emperor' },
  { emoji: '⚖️', name: 'Justice' },
  { emoji: '🌙', name: 'The Moon' },
  { emoji: '☀️', name: 'The Sun' },
  { emoji: '🕯️', name: 'The Hermit' },
  { emoji: '🎭', name: 'The Lovers' },
  { emoji: '🔱', name: 'The Devil' }
];

const MAX_STAMPS = 10;

const StampScreen = () => {
  const { customer } = useAuth();
  const [currentCustomer, setCurrentCustomer] = useState(customer);

  useEffect(() => {
    setCurrentCustomer(customer);
  }, [customer]);

  const currentStamps = useMemo(() => currentCustomer?.current_stamps || 0, [currentCustomer]);

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.wrapper}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>STAMP BOARD</Text>
          </View>
          <View style={styles.headerDivider} />
          <Text style={styles.subtitle}>현재 적립 현황을 확인해보세요</Text>
        </View>

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
                  <Text style={styles.stampEmoji}>{filled ? tarotCards[i].emoji : ''}</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.visitInfo}>
            최근 방문: {currentCustomer?.last_visit ? new Date(currentCustomer.last_visit).toLocaleString('ko-KR') : '기록 없음'}
          </Text>

          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>스탬프 적립/수정/쿠폰 발급은 매장에서 직원 확인 후 진행됩니다.</Text>
          </View>
        </View>
      </ScrollView>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  wrapper: { padding: 16, paddingTop: 28, paddingBottom: 120 },
  header: { ...CommonStyles.headerBoard, marginBottom: 18 },
  titleRow: CommonStyles.titleRow,
  title: CommonStyles.title,
  headerDivider: CommonStyles.headerDivider,
  subtitle: CommonStyles.subtitle,
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
  noticeBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 12,
  },
  noticeText: { color: '#f1f1f1', fontSize: 13, lineHeight: 19 }
});

export default StampScreen;
