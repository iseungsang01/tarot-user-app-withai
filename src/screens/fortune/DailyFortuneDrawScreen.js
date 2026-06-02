import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoldActionButton, PremiumCard, PremiumHeaderPanel, ScreenContainer } from '../../components';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { useAuth } from '../../hooks/useAuth';
import { getDailyFortune, normalizeDailyFortunePayload } from '../../services/aiService';
import { storage } from '../../utils/storage';
import {
  buildCardContext,
  buildStoredDailyFortune,
  canDrawDailyFortune,
  getDrawButtonLabel,
  getLocalDateString,
  getStoredDrawCount,
  pickRandomMajorArcana,
} from '../../utils/dailyFortune';

const DailyFortuneDrawScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { customer } = useAuth();
  const [todayFortune, setTodayFortune] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [resultFortune, setResultFortune] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);

  const todayStr = useMemo(() => getLocalDateString(), []);

  const loadTodayFortune = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await storage.getDailyFortune(todayStr);
      setTodayFortune(normalizeDailyFortunePayload(stored));
      setSelectedCard(null);
      setResultFortune(null);
    } catch (error) {
      console.error('Daily fortune draw load error:', error);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useFocusEffect(
    useCallback(() => {
      loadTodayFortune();
    }, [loadTodayFortune])
  );

  useEffect(() => {
    loadTodayFortune();
  }, [loadTodayFortune]);

  const handleDraw = async () => {
    const latestStored = normalizeDailyFortunePayload(await storage.getDailyFortune(todayStr));
    if (!canDrawDailyFortune(latestStored)) {
      setTodayFortune(latestStored);
      Alert.alert('오늘의 카드', '오늘의 카드는 모두 뽑았습니다.');
      return;
    }

    const card = pickRandomMajorArcana();
    const nextDrawCount = getStoredDrawCount(latestStored) + 1;
    setSelectedCard(card);
    setResultFortune(null);
    setIsDrawing(true);

    try {
      const nickname = customer?.nickname || customer?.name || '사용자';
      const previousFortune = latestStored?.fortune || '';
      const cardContext = buildCardContext(card);
      const fortuneResult = await getDailyFortune(nickname, previousFortune, cardContext, { countUsage: nextDrawCount > 1 });

      if (fortuneResult.error) throw fortuneResult.error;

      const finalFortune = buildStoredDailyFortune({
        card,
        fortunePayload: normalizeDailyFortunePayload(fortuneResult.data),
        drawCount: nextDrawCount,
      });

      await Promise.all([
        storage.saveDailyFortune(finalFortune, todayStr),
        storage.saveAttendance(todayStr),
      ]);

      setTodayFortune(finalFortune);
      setResultFortune(finalFortune);
    } catch (error) {
      console.error('Daily fortune draw error:', error);
      if (!error?.isAuthError && !error?.requiresReLogin) {
        Alert.alert('오류', '카드의 의미를 해석하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setIsDrawing(false);
    }
  };

  const canDraw = canDrawDailyFortune(todayFortune) && !isDrawing;

  return (
    <ScreenContainer safeTop={false} safeBottom={false}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 36 }}
        showsVerticalScrollIndicator={false}
      >
        <PremiumHeaderPanel
          title="CARD RITUAL"
          subtitle="덱에서 오늘의 카드 한 장을 뽑습니다"
          compact
          style={styles.header}
        />

        <PremiumCard style={styles.drawPanel} contentStyle={styles.drawPanelContent}>
          <View style={styles.deckArea}>
            {!selectedCard && (
              <>
                <View style={[styles.deckShadowCard, styles.deckShadowLeft]} />
                <View style={[styles.deckShadowCard, styles.deckShadowRight]} />
                <View style={[styles.deckShadowCard, styles.deckShadowBack]} />
              </>
            )}
            <TouchableOpacity
              activeOpacity={0.86}
              style={[styles.cardStage, selectedCard && styles.cardStageRevealed]}
              onPress={canDraw ? handleDraw : undefined}
              disabled={!canDraw || loading}
              accessibilityRole="button"
              accessibilityLabel="오늘의 카드 한 장 뽑기"
            >
              {selectedCard ? (
                <Image source={selectedCard.image} style={styles.cardImage} resizeMode="contain" />
              ) : (
                <LinearGradient colors={['#3B0B24', '#09000D']} style={styles.cardBackGradient}>
                  <View style={styles.cardPattern}>
                    <View style={styles.innerPattern}>
                      <Text style={styles.cardPatternText}>T</Text>
                      <Text style={styles.cardPatternSubText}>TAROT DECK</Text>
                    </View>
                  </View>
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>

          {!selectedCard && <Text style={styles.tapHint}>덱을 터치하면 카드가 한 장 올라옵니다</Text>}

          {selectedCard && (
            <View style={styles.selectedCardInfo}>
              <Text style={styles.selectedCardName}>{selectedCard.nameKr}</Text>
              <Text style={styles.selectedCardEnglish}>{selectedCard.name}</Text>
            </View>
          )}

          {isDrawing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={DrawerTheme.antiqueGold} />
              <Text style={styles.loadingText}>카드의 의미를 해석하는 중...</Text>
            </View>
          ) : (
            <GoldActionButton onPress={handleDraw} disabled={!canDraw || loading} dark={!canDraw} style={styles.drawButton}>
              {loading ? '확인 중...' : getDrawButtonLabel(todayFortune)}
            </GoldActionButton>
          )}
        </PremiumCard>

        {resultFortune && (
          <PremiumCard style={styles.resultPanel}>
            <Text style={styles.resultTitle}>오늘의 카드 기록</Text>
            {!!resultFortune.summary && <Text style={styles.summaryText}>{resultFortune.summary}</Text>}
            <Text style={styles.fortuneText}>{resultFortune.fortune}</Text>
            <View style={styles.detailGrid}>
              <DetailItem label="관계" value={resultFortune.relationship} />
              <DetailItem label="일/공부" value={resultFortune.work} />
              <DetailItem label="금전" value={resultFortune.money} />
              <DetailItem label="주의" value={resultFortune.care} />
              <DetailItem label="행동" value={resultFortune.action} />
            </View>
            <View style={styles.fortuneFooter}>
              <View style={styles.fortuneInfo}>
                <Text style={styles.infoLabel}>행운의 색</Text>
                <Text style={styles.infoValue}>{resultFortune.luckyColor}</Text>
              </View>
              <View style={styles.fortuneInfo}>
                <Text style={styles.infoLabel}>행운의 아이템</Text>
                <Text style={styles.infoValue}>{resultFortune.luckyItem}</Text>
              </View>
            </View>
          </PremiumCard>
        )}

        <TouchableOpacity style={styles.backButton} activeOpacity={0.84} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>운세 기록으로 돌아가기</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
};

const DetailItem = ({ label, value }) => {
  if (!value) return null;
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { marginBottom: 16 },
  drawPanel: { overflow: 'hidden' },
  drawPanelContent: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  deckArea: { width: '100%', minHeight: 322, alignItems: 'center', justifyContent: 'center', marginTop: 0, position: 'relative' },
  deckShadowCard: {
    position: 'absolute',
    width: 188,
    height: 292,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.28)',
    backgroundColor: 'rgba(42,6,44,0.72)',
  },
  deckShadowLeft: { transform: [{ translateX: -18 }, { translateY: 12 }, { rotate: '-6deg' }] },
  deckShadowRight: { transform: [{ translateX: 18 }, { translateY: 12 }, { rotate: '6deg' }] },
  deckShadowBack: { transform: [{ translateX: 0 }, { translateY: 18 }], backgroundColor: 'rgba(18,0,8,0.9)' },
  cardStage: {
    width: 188,
    height: 292,
    alignSelf: 'center',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(224,193,104,0.72)',
    backgroundColor: DrawerTheme.bgBlackCherry,
    shadowColor: DrawerTheme.brassHighlight,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardStageRevealed: { transform: [{ translateY: -6 }], borderColor: 'rgba(255,217,119,0.85)' },
  cardBackGradient: { flex: 1, padding: 10 },
  cardPattern: { flex: 1, borderWidth: 1, borderColor: 'rgba(200,163,64,0.34)', borderRadius: 14, padding: 8 },
  innerPattern: { flex: 1, borderWidth: 1, borderColor: 'rgba(200,163,64,0.2)', borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,0,9,0.28)' },
  cardPatternText: { color: DrawerTheme.antiqueGold, fontSize: 44, fontWeight: '900', opacity: 0.88 },
  cardPatternSubText: { color: DrawerTheme.mutedIvory, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginTop: 8 },
  cardImage: { width: '100%', height: '100%' },
  tapHint: { color: DrawerTheme.mutedIvory, fontSize: 12, fontWeight: '700', marginTop: -4, marginBottom: 2, opacity: 0.82 },
  selectedCardInfo: { alignItems: 'center', marginTop: 10 },
  selectedCardName: { color: DrawerTheme.goldBright, fontSize: 18, fontWeight: '900' },
  selectedCardEnglish: { color: DrawerTheme.mutedIvory, fontSize: 12, fontWeight: '700', marginTop: 3 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(7,0,9,0.35)' },
  loadingText: { color: DrawerTheme.goldBright, fontSize: 14, fontWeight: '800' },
  drawButton: { alignSelf: 'center', width: '72%', minWidth: 220, maxWidth: 320, marginTop: 20 },
  resultPanel: { marginTop: 14 },
  resultTitle: { color: DrawerTheme.antiqueGold, fontSize: 18, fontWeight: '900', marginBottom: 10 },
  summaryText: { color: DrawerTheme.goldBright, fontSize: 16, fontWeight: '900', marginBottom: 10 },
  fortuneText: { color: DrawerTheme.ivory, fontSize: 15, lineHeight: 24, marginBottom: 16 },
  detailGrid: { gap: 10, marginBottom: 16 },
  detailItem: { backgroundColor: 'rgba(7,0,9,0.28)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(200,163,64,0.14)' },
  detailLabel: { color: DrawerTheme.antiqueGold, fontSize: 12, fontWeight: '900', marginBottom: 5 },
  detailValue: { color: DrawerTheme.ivory, fontSize: 14, lineHeight: 21 },
  fortuneFooter: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: 'rgba(200,163,64,0.18)', paddingTop: 15 },
  fortuneInfo: { alignItems: 'center', flex: 1 },
  infoLabel: { fontSize: 12, color: DrawerTheme.mutedIvory, marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '800', color: DrawerTheme.goldBright, textAlign: 'center' },
  backButton: { alignItems: 'center', marginTop: 18, paddingVertical: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,217,119,0.45)', backgroundColor: 'rgba(200,163,64,0.12)' },
  backButtonText: { color: DrawerTheme.ivory, fontSize: 15, fontWeight: '900' },
});

export default DailyFortuneDrawScreen;
