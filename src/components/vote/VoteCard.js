import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { PremiumCard } from '../common/PremiumUI';

export const VoteCard = ({ vote, onPress }) => {
  const formatShortDate = (dateString) => {
    if (!dateString) return '마감 없음';
    const date = new Date(dateString);
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  };

  const isExpired = vote.ends_at && new Date(vote.ends_at) < new Date();

  return (
    <TouchableOpacity onPress={() => onPress(vote)} activeOpacity={0.84}>
      <PremiumCard style={[styles.card, isExpired && styles.cardExpired]}>
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

        <Text style={styles.title} numberOfLines={2}>{vote.title}</Text>
        {!!vote.description && <Text style={styles.description} numberOfLines={2}>{vote.description}</Text>}

        <View style={styles.cardFooter}>
          <Text style={styles.footerInfo}>셀러의 선택에 참여하세요</Text>
          <Text style={styles.enterText}>{isExpired ? '결과보기' : '참여하기'}</Text>
        </View>
      </PremiumCard>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  cardExpired: {
    opacity: 0.72,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  badgeOpen: { backgroundColor: DrawerTheme.antiqueGold },
  badgeClosed: { backgroundColor: 'rgba(205,187,150,0.18)' },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    color: DrawerTheme.bgBlackCherry,
  },
  typeBadge: {
    backgroundColor: 'rgba(7,0,9,0.34)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.22)',
  },
  typeBadgeText: {
    fontSize: 9,
    color: DrawerTheme.mutedGold,
    fontWeight: '800',
  },
  dateText: {
    fontSize: 10,
    color: DrawerTheme.mutedIvory,
    opacity: 0.9,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: DrawerTheme.ivory,
    marginBottom: 8,
    lineHeight: 24,
  },
  description: {
    fontSize: 13,
    color: DrawerTheme.mutedIvory,
    lineHeight: 19,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,163,64,0.18)',
    gap: 10,
  },
  footerInfo: {
    fontSize: 12,
    color: DrawerTheme.mutedIvory,
    opacity: 0.86,
    flex: 1,
  },
  enterText: {
    fontSize: 12,
    color: DrawerTheme.goldBrass,
    fontWeight: '900',
  },
});
