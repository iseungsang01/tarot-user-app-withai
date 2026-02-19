import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { formatDateShort } from '../utils/formatters';
import { DrawerTheme } from '../constants/DrawerTheme';

export const CouponCard = ({ coupon, type, onPress }) => {
  const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date();
  const themeColor = type === 'stamp' ? DrawerTheme.goldBrass : '#D4A5A5';
  const icon = type === 'stamp' ? '📜' : '🎁';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { 
          borderColor: isExpired ? '#333' : 'rgba(212, 175, 55, 0.3)',
          backgroundColor: isExpired ? 'rgba(20,20,20,0.6)' : DrawerTheme.woodDark 
        },
        isExpired && styles.cardExpired,
      ]}
      onPress={() => !isExpired && onPress(coupon)}
      disabled={isExpired}
      activeOpacity={0.8}
    >
      {/* 측면 포인트 */}
      <View style={[styles.sideAccent, { backgroundColor: isExpired ? '#444' : themeColor }]} />

      <View style={styles.content}>
        <Text style={[styles.icon, isExpired && styles.iconExpired]}>{icon}</Text>
        
        <View style={styles.info}>
          <View style={styles.header}>
            <Text style={[styles.category, { color: isExpired ? '#666' : themeColor }]}>
              {type === 'stamp' ? '스탬프 쿠폰' : '생일 쿠폰'}
            </Text>
            {!isExpired && <Text style={[styles.useHint, { color: themeColor }]}>사용하기 ›</Text>}
          </View>

          {/* 일자 정보: 가로로 배치하여 슬림함 유지 */}
          <View style={styles.dateRow}>
            <Text style={styles.dateText}>발급: {formatDateShort(coupon.issued_at)}</Text>
            <View style={styles.dateDivider} />
            <Text style={[styles.dateText, !isExpired && { color: '#BBB' }]}>
              만료: {coupon.valid_until ? formatDateShort(coupon.valid_until) : '무제한'}
            </Text>
            {isExpired && <Text style={styles.expiredLabel}>[만료]</Text>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 8,
    height: 70, // 일자 추가로 인해 5px만 살짝 키움
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2 },
      android: { elevation: 4 },
    }),
  },
  cardExpired: {
    opacity: 0.6,
  },
  sideAccent: {
    width: 4,
    height: '100%',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  icon: {
    fontSize: 22,
    marginRight: 12,
  },
  iconExpired: {
    opacity: 0.4,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  useHint: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    color: '#888',
  },
  dateDivider: {
    width: 1,
    height: 8,
    backgroundColor: '#444',
    marginHorizontal: 8,
  },
  expiredLabel: {
    fontSize: 10,
    color: '#666',
    marginLeft: 5,
    fontWeight: 'bold',
  },
});