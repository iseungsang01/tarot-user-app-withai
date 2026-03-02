import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground } from '../components/common/GradientBackground';
import { DrawerTheme } from '../constants/DrawerTheme';
import { CommonStyles } from '../styles/CommonStyles';
import { useAuth } from '../hooks/useAuth';

const { width } = Dimensions.get('window');
// Padding: wrapper (20*2) + card (22*2) + grid (4*2) = 92
// Gaps: 4 gaps * 8px = 32
// Available width for 5 items = width - 92 - 32
const STAMP_SIZE = (width - 124) / 5;

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
  const insets = useSafeAreaInsets();
  const { customer } = useAuth();
  const [currentCustomer, setCurrentCustomer] = useState(customer);

  useEffect(() => {
    setCurrentCustomer(customer);
  }, [customer]);

  const currentStamps = useMemo(() => currentCustomer?.current_stamps || 0, [currentCustomer]);
  const progressPercent = (currentStamps / MAX_STAMPS) * 100;

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[
          styles.wrapper,
          { paddingTop: insets.top + 20 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>STAMP BOARD</Text>
          </View>
          <View style={styles.headerDivider} />
          <Text style={styles.subtitle}>오늘의 상담이 한 조각의 기록이 됩니다</Text>
        </View>

        {/* 🏆 Progress Overview Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>진행도</Text>
            </View>
            <Text style={styles.cardHeaderText}>현재 적립 현황</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.progressValue}>
              <Text style={styles.currentCount}>{currentStamps}</Text>
              <Text style={styles.totalCount}> / {MAX_STAMPS}</Text>
            </Text>
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBg}>
                <LinearGradient
                  colors={[DrawerTheme.goldBrass, DrawerTheme.goldBright]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                />
              </View>
            </View>

            <Text style={styles.rewardHint}>
              {currentStamps >= MAX_STAMPS
                ? '✨ 모든 스탬프를 모으셨습니다! 쿠폰을 확인해주세요.'
                : `앞으로 ${MAX_STAMPS - currentStamps}개의 스탬프를 더 모으면 쿠폰이 발송됩니다.`}
            </Text>
          </View>
        </View>

        {/* 📜 Main Stamp Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.collectionBadge}>
              <Text style={styles.collectionBadgeText}>COLLECTION</Text>
            </View>
            <Text style={styles.cardHeaderText}>TAROT CARDS</Text>
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.stampGrid}>
              {Array.from({ length: MAX_STAMPS }).map((_, i) => {
                const filled = i < currentStamps;
                return (
                  <View key={`stamp-${i}`} style={styles.stampWrapper}>
                    <View style={[styles.stampFrame, filled && styles.stampFrameFilled]}>
                      {filled ? (
                        <View style={styles.filledContent}>
                          <LinearGradient
                            colors={['rgba(212, 175, 55, 0.2)', 'rgba(212, 175, 55, 0.05)']}
                            style={styles.stampInnerGlow}
                          />
                          <Text style={styles.stampEmoji}>{tarotCards[i].emoji}</Text>
                        </View>
                      ) : (
                        <Text style={styles.indexText}>{i + 1}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.footerText}>10 STAMPS = 1 FREE SESSION COUPON</Text>
            </View>
          </View>
        </View>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>📜 이용 안내</Text>
          <View style={styles.noticeContent}>
            <Text style={styles.noticeText}>• 상담 완료 시 자동으로 스탬프가 적립됩니다.</Text>
            <Text style={styles.noticeText}>• 10개를 모두 모으면 쿠폰함으로 무료 상담권이 발송됩니다.</Text>
            <Text style={styles.noticeText}>• 발급된 쿠폰의 유효기간은 발행일로부터 3개월입니다.</Text>
            <Text style={styles.noticeText}>• 스탬프 적립 내역은 본인 명의의 계정에서만 유효합니다.</Text>
          </View>
        </View>
      </ScrollView>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, paddingBottom: 100 },
  header: CommonStyles.headerBoard,
  titleRow: CommonStyles.titleRow,
  title: CommonStyles.title,
  headerDivider: CommonStyles.headerDivider,
  subtitle: CommonStyles.subtitle,

  // Card Design (NoticeCard 스타일 기반)
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  contentContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },

  // Badge Styles (NoticeCard Pin Badge 참고)
  statusBadge: {
    backgroundColor: DrawerTheme.goldBrass,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginRight: 8,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#3D2B1F',
  },
  collectionBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    marginRight: 8,
  },
  collectionBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: DrawerTheme.goldBrass,
  },

  // Progress UI
  progressValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currentCount: {
    color: DrawerTheme.goldBright,
    fontSize: 22,
    fontWeight: 'bold',
  },
  totalCount: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    width: '100%',
    marginBottom: 12,
  },
  progressBarBg: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  rewardHint: {
    color: '#A68966',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.8,
  },

  // Stamp Grid UI
  stampGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },

  stampWrapper: {
    width: '18.5%', // Guarantees 5 items per row
    aspectRatio: 0.7, // Tarot card比例
    marginVertical: 4,
  },
  stampFrame: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stampFrameFilled: {
    borderColor: DrawerTheme.goldBrass,
    borderWidth: 1.5,
    backgroundColor: 'rgba(45, 35, 20, 0.6)',
    shadowColor: DrawerTheme.goldBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  filledContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampInnerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
  },
  stampEmoji: {
    fontSize: 26,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.6, shadowRadius: 4 },
      android: { elevation: 4 }
    })
  },
  indexText: {
    color: 'rgba(212, 175, 55, 0.1)',
    fontSize: 18,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  cardFooter: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    color: DrawerTheme.goldBrass,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.9,
  },

  // Notice Box
  noticeBox: {
    backgroundColor: 'rgba(139, 90, 43, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 90, 43, 0.15)',
    marginTop: 8,
  },
  noticeTitle: {
    color: DrawerTheme.woodLight,
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  noticeContent: {
    gap: 6,
  },
  noticeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    lineHeight: 18,
  }
});

export default StampScreen;
