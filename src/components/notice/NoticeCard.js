import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { PremiumCard } from '../common/PremiumUI';
import { formatDateDot } from '../../utils/formatters';

export const NoticeCard = ({ notice, onPress }) => {
  const parseContent = (content) => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'link', text: match[1], url: match[2] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) parts.push({ type: 'text', content: content.substring(lastIndex) });
    return parts.length > 0 ? parts : [{ type: 'text', content }];
  };

  const handleLinkPress = (url) => {
    Linking.openURL(url).catch((err) => console.error('링크 열기 실패:', err));
  };

  const contentParts = parseContent(notice.content || '');

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => onPress?.(notice)}>
      <PremiumCard variant={notice.is_pinned ? 'walnut' : 'card'} style={styles.card}>
        <View style={styles.titleRow}>
          <View style={styles.leftContent}>
            {notice.is_pinned && (
              <View style={styles.pinBadge}>
                <Text style={styles.pinBadgeText}>중요</Text>
              </View>
            )}
            <Text style={styles.title} numberOfLines={1}>{notice.title}</Text>
          </View>
          <Text style={styles.dateText}>{formatDateDot(notice.created_at)}</Text>
        </View>

        <View style={styles.contentContainer}>
          {contentParts.map((part, index) => {
            if (part.type === 'link') {
              return <Text key={index} style={styles.linkText} onPress={() => handleLinkPress(part.url)}>{part.text}</Text>;
            }
            return <Text key={index} style={styles.bodyText}>{part.content}</Text>;
          })}
        </View>
        <Text style={styles.detailHint}>자세히 보기</Text>
      </PremiumCard>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  detailHint: {
    marginTop: 14,
    color: DrawerTheme.goldBrass,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
    opacity: 0.95,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 10,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  pinBadge: {
    backgroundColor: DrawerTheme.goldBrass,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  pinBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: DrawerTheme.bgBlackCherry,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: DrawerTheme.ivory,
    flexShrink: 1,
  },
  dateText: {
    fontSize: 10,
    color: DrawerTheme.mutedIvory,
    opacity: 0.9,
  },
  contentContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,163,64,0.18)',
  },
  bodyText: {
    fontSize: 14,
    color: DrawerTheme.mutedIvory,
    lineHeight: 23,
  },
  linkText: {
    fontSize: 14,
    color: DrawerTheme.goldBrass,
    lineHeight: 23,
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
});
