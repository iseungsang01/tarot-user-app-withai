import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerTheme } from '../constants/DrawerTheme';

export const VoteCard = ({ vote, onPress }) => {
  // 날짜 포맷: 26.01.12
  const formatShortDate = (dateString) => {
    if (!dateString) return '제한 없음';
    const date = new Date(dateString);
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  };

  const isExpired = vote.ends_at && new Date(vote.ends_at) < new Date();

  return (
    <TouchableOpacity
      style={[styles.card, isExpired && styles.cardExpired]}
      onPress={() => onPress(vote)}
      activeOpacity={0.8}
    >
      {/* 상단: 뱃지들 + 우측 날짜 */}
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          <View style={[styles.statusBadge, isExpired ? styles.badgeClosed : styles.badgeOpen]}>
            <Text style={styles.statusText}>{isExpired ? '종료' : '진행중'}</Text>
          </View>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{vote.allow_multiple ? '복수' : '단일'}</Text>
          </View>
          {vote.is_anonymous && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>익명</Text>
            </View>
          )}
        </View>
        <Text style={styles.dateText}>{formatShortDate(vote.ends_at)} 마감</Text>
      </View>

      {/* 제목 */}
      <Text style={styles.title} numberOfLines={1}>
        {vote.title}
      </Text>

      {/* 하단 푸터 */}
      <View style={styles.cardFooter}>
        <Text style={styles.footerInfo}>소중한 의견을 남겨주세요</Text>
        <Text style={styles.enterText}>{isExpired ? '결과보기 ❯' : '참여하기 ❯'}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#4A3728',
    borderRadius: 16,
    padding: 22,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  cardExpired: {
    opacity: 0.7,
    backgroundColor: '#3D2B1F',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBadge: {
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  badgeOpen: { backgroundColor: DrawerTheme.goldBrass },
  badgeClosed: { backgroundColor: 'rgba(255,255,255,0.2)' },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#3D2B1F',
  },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  typeBadgeText: {
    fontSize: 9,
    color: '#A68966',
  },
  dateText: {
    fontSize: 10,
    color: '#A68966',
    opacity: 0.8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerInfo: {
    fontSize: 12,
    color: '#D4C4B5',
    opacity: 0.6,
  },
  enterText: {
    fontSize: 12,
    color: DrawerTheme.goldBrass,
    fontWeight: 'bold',
  },
});