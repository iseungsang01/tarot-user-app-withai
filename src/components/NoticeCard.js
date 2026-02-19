import React from 'react';
import { View, Text, StyleSheet, Linking, Platform } from 'react-native';
import { DrawerTheme } from '../constants/DrawerTheme';

export const NoticeCard = ({ notice }) => {
  // 날짜 포맷 함수: 25.01.01
  const formatShortDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  };

  const parseContent = (content) => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, match.index),
        });
      }
      parts.push({
        type: 'link',
        text: match[1],
        url: match[2],
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex),
      });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content }];
  };

  const handleLinkPress = (url) => {
    Linking.openURL(url).catch((err) => console.error('링크 열기 실패:', err));
  };

  const contentParts = parseContent(notice.content);

  return (
    <View style={[styles.card, notice.is_pinned && styles.cardPinned]}>
      {/* 제목과 날짜가 한 줄에 있고, 날짜만 오른쪽 끝으로 */}
      <View style={styles.titleRow}>
        <View style={styles.leftContent}>
          {notice.is_pinned && (
            <View style={styles.pinBadge}>
              <Text style={styles.pinBadgeText}>중요</Text>
            </View>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {notice.title}
          </Text>
        </View>
        
        <Text style={styles.dateText}>
          {formatShortDate(notice.created_at)}
        </Text>
      </View>

      <View style={styles.contentContainer}>
        {contentParts.map((part, index) => {
          if (part.type === 'link') {
            return (
              <Text
                key={index}
                style={styles.linkText}
                onPress={() => handleLinkPress(part.url)}
              >
                {part.text}
              </Text>
            );
          }
          return (
            <Text key={index} style={styles.bodyText}>
              {part.content}
            </Text>
          );
        })}
      </View>
    </View>
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
  cardPinned: {
    backgroundColor: '#5D4333',
  },
  // 핵심: space-between으로 좌우 끝 정렬
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', 
    marginBottom: 15,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // 제목 영역이 날짜 전까지 공간을 차지하게 함
    gap: 8,
  },
  pinBadge: {
    backgroundColor: DrawerTheme.goldBrass,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  pinBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#3D2B1F',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flexShrink: 1, // 제목이 너무 길면 날짜를 가리지 않게 조절
  },
  dateText: {
    fontSize: 10,
    color: '#A68966',
    opacity: 0.8,
    marginLeft: 10, // 제목과의 최소 간격 확보
  },
  contentContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  bodyText: {
    fontSize: 15,
    color: '#D4C4B5',
    lineHeight: 24,
  },
  linkText: {
    fontSize: 15,
    color: DrawerTheme.goldBrass,
    lineHeight: 24,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});