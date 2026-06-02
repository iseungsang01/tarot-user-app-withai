import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoldActionButton, PremiumCard, PremiumHeaderPanel, ScreenContainer } from '../../components';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { MAJOR_ARCANA } from '../../constants/TarotCards';
import { normalizeDailyFortunePayload } from '../../services/aiService';
import { storage } from '../../utils/storage';
import {
  canDrawDailyFortune,
  getCardById,
  getCardImageSource,
  getDrawButtonLabel,
  getLocalDateString,
  getRemainingDraws,
  getStoredDrawCount,
} from '../../utils/dailyFortune';

const isErrorFortune = (fortune) => {
  if (!fortune?.fortune) return false;
  return String(fortune.fortune).includes('Error');
};

const hasValidFortune = (fortune) => !!fortune?.fortune && !isErrorFortune(fortune);

const formatDateTitle = (dateStr, todayStr) => {
  if (!dateStr) return '카드 기록';
  if (dateStr === todayStr) return '오늘의 카드 기록';
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}월 ${Number(day)}일의 카드 기록`;
};

const DailyFortuneScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [allFortunes, setAllFortunes] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedFortune, setSelectedFortune] = useState(null);
  const [selectedCardPreview, setSelectedCardPreview] = useState(null);

  const today = useMemo(() => new Date(), []);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const todayStr = getLocalDateString(today);

  const loadLocalData = useCallback(async () => {
    setLoading(true);
    try {
      const fortunes = await storage.getAllFortunes();
      const history = await storage.getAttendanceHistory();
      const safeFortunes = Object.fromEntries(
        Object.entries(fortunes || {}).map(([date, fortune]) => [date, normalizeDailyFortunePayload(fortune)])
      );

      setAllFortunes(safeFortunes);
      setAttendanceHistory(history || []);
      setSelectedDate(todayStr);
      setSelectedFortune(safeFortunes[todayStr] || null);
    } catch (error) {
      console.error('Daily fortune load error:', error);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  useFocusEffect(
    useCallback(() => {
      loadLocalData();
    }, [loadLocalData])
  );

  useEffect(() => {
    MAJOR_ARCANA.forEach((card) => {
      if (typeof card?.image === 'string') Image.prefetch(card.image);
    });
  }, []);

  const handleDatePress = (dateStr) => {
    setSelectedDate(dateStr);
    setSelectedFortune(allFortunes[dateStr] || null);
  };

  const handleStartCardDraw = () => {
    if (!canDrawDailyFortune(allFortunes[todayStr])) return;
    navigation.navigate('DailyFortuneDraw');
  };

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i += 1) {
      days.push(<View key={`empty-${i}`} style={styles.dayBox} />);
    }

    for (let d = 1; d <= daysInMonth; d += 1) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isAttended = attendanceHistory.includes(dateStr);
      const isToday = todayStr === dateStr;
      const fortuneForDay = allFortunes[dateStr];
      const hasFortune = hasValidFortune(fortuneForDay);
      const isSelected = selectedDate === dateStr;

      days.push(
        <TouchableOpacity key={dateStr} style={styles.dayBox} onPress={() => handleDatePress(dateStr)} activeOpacity={0.76}>
          <View style={[styles.dayCircle, isAttended && styles.attendedCircle, isToday && styles.todayCircle, isSelected && styles.selectedCircle]}>
            <Text style={[styles.dayText, isAttended && styles.attendedText, isToday && styles.todayText, isSelected && styles.selectedText]}>{d}</Text>
          </View>
          {hasFortune && <View style={styles.fortuneMarker} />}
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.calendarGrid}>
        {['일', '월', '화', '수', '목', '금', '토'].map((weekday) => (
          <View key={weekday} style={styles.dayBox}>
            <Text style={styles.weekdayText}>{weekday}</Text>
          </View>
        ))}
        {days}
      </View>
    );
  }, [allFortunes, attendanceHistory, currentMonth, currentYear, selectedDate, todayStr]);

  const todayFortune = allFortunes[todayStr];
  const selectedCardSource = selectedFortune ? getCardImageSource(selectedFortune) : null;
  const selectedCard = selectedFortune ? getCardById(selectedFortune.cardId) : null;
  const selectedIsToday = selectedDate === todayStr;
  const drawCount = getStoredDrawCount(todayFortune);
  const remainingDraws = getRemainingDraws(todayFortune);
  const canDrawToday = canDrawDailyFortune(todayFortune);

  return (
    <ScreenContainer safeTop={false} safeBottom={false}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <PremiumHeaderPanel
          title="FORTUNE ARCHIVE"
          subtitle={`${currentYear}년 ${currentMonth + 1}월의 오늘 운세 보관소`}
          compact
          style={styles.header}
        />

        <PremiumCard style={styles.card}>
          {loading ? <ActivityIndicator color={DrawerTheme.antiqueGold} size="large" style={styles.loading} /> : calendarGrid}
        </PremiumCard>

        <PremiumCard style={styles.statusCard}>
          <Text style={styles.statusTitle}>오늘의 운세 상태</Text>
          <Text style={styles.statusText}>
            {hasValidFortune(todayFortune)
              ? `오늘 ${drawCount}회 뽑았습니다. 남은 횟수는 ${remainingDraws}회입니다.`
              : '아직 오늘의 카드를 뽑지 않았습니다.'}
          </Text>
          <GoldActionButton onPress={handleStartCardDraw} disabled={!canDrawToday} dark={!canDrawToday} style={styles.drawButton}>
            {getDrawButtonLabel(todayFortune)}
          </GoldActionButton>
        </PremiumCard>

        {selectedFortune ? (
          <PremiumCard style={styles.fortuneCard}>
            <Text style={styles.fortuneTitle}>{formatDateTitle(selectedDate, todayStr)}</Text>

            {selectedCardSource && (
              <View style={styles.resultCardContainer}>
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={() => setSelectedCardPreview({ source: selectedCardSource, name: selectedCard?.name || selectedFortune.cardEnglishName || selectedFortune.cardName })}
                  accessibilityRole="button"
                  accessibilityLabel={`${selectedFortune.cardName || '타로 카드'} 크게 보기`}
                >
                  <Image source={selectedCardSource} style={styles.resultCardImage} resizeMode="contain" />
                </TouchableOpacity>
                <Text style={styles.resultCardName}>{selectedFortune.cardName}</Text>
                {!!(selectedCard?.name || selectedFortune.cardEnglishName) && (
                  <Text style={styles.resultCardSubName}>{selectedCard?.name || selectedFortune.cardEnglishName}</Text>
                )}
              </View>
            )}

            {!!selectedFortune.summary && <Text style={styles.summaryText}>{selectedFortune.summary}</Text>}
            <Text style={styles.fortuneContent}>{selectedFortune.fortune}</Text>

            <View style={styles.detailGrid}>
              <DetailItem label="관계" value={selectedFortune.relationship} />
              <DetailItem label="일/공부" value={selectedFortune.work} />
              <DetailItem label="금전" value={selectedFortune.money} />
              <DetailItem label="주의" value={selectedFortune.care} />
              <DetailItem label="행동" value={selectedFortune.action} wide />
            </View>

            <View style={styles.fortuneFooter}>
              <View style={styles.fortuneInfo}>
                <Text style={styles.infoLabel}>행운의 색</Text>
                <Text style={styles.infoValue}>{selectedFortune.luckyColor}</Text>
              </View>
              <View style={styles.fortuneInfo}>
                <Text style={styles.infoLabel}>행운의 아이템</Text>
                <Text style={styles.infoValue}>{selectedFortune.luckyItem}</Text>
              </View>
            </View>
          </PremiumCard>
        ) : selectedDate && !selectedIsToday ? (
          <PremiumCard style={styles.noFortuneCard}>
            <Text style={styles.noFortuneText}>이 날짜에는 저장된 카드 기록이 없습니다.</Text>
          </PremiumCard>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(selectedCardPreview)} transparent animationType="fade" onRequestClose={() => setSelectedCardPreview(null)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedCardPreview(null)}
          accessibilityRole="button"
          accessibilityLabel="타로 카드 확대 닫기"
        >
          <View style={styles.modalCardWrap}>
            <TouchableOpacity activeOpacity={1}>
              {selectedCardPreview && (
                <>
                  <Image source={selectedCardPreview.source} style={styles.modalStampImage} resizeMode="contain" />
                  <Text style={styles.modalStampName}>{selectedCardPreview.name}</Text>
                  <TouchableOpacity style={styles.modalCloseButton} activeOpacity={0.84} onPress={() => setSelectedCardPreview(null)}>
                    <Text style={styles.modalCloseText}>닫기</Text>
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenContainer>
  );
};

const DetailItem = ({ label, value, wide = false }) => {
  if (!value) return null;
  return (
    <View style={[styles.detailItem, wide && styles.detailItemWide]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { marginBottom: 16 },
  card: { padding: 15 },
  loading: { marginVertical: 40 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayBox: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', padding: 2, position: 'relative' },
  weekdayText: { color: DrawerTheme.mutedIvory, fontSize: 12, fontWeight: '800', opacity: 0.8 },
  dayCircle: { width: '80%', height: '80%', borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(7,0,9,0.38)' },
  dayText: { color: DrawerTheme.ivory, fontSize: 14, fontWeight: '600' },
  attendedCircle: { backgroundColor: 'rgba(200,163,64,0.12)' },
  attendedText: { color: DrawerTheme.goldBright, fontWeight: '900' },
  todayCircle: { borderWidth: 2, borderColor: DrawerTheme.antiqueGold },
  todayText: { fontWeight: '900' },
  selectedCircle: { backgroundColor: DrawerTheme.antiqueGold },
  selectedText: { color: DrawerTheme.bgBlackCherry, fontWeight: '900' },
  fortuneMarker: { position: 'absolute', bottom: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: DrawerTheme.antiqueGold, borderWidth: 1, borderColor: DrawerTheme.bgBlackCherry },
  statusCard: { marginTop: 18, marginBottom: 12 },
  statusTitle: { color: DrawerTheme.antiqueGold, fontSize: 17, fontWeight: '900', marginBottom: 8 },
  statusText: { color: DrawerTheme.ivory, fontSize: 14, lineHeight: 22, marginBottom: 14 },
  drawButton: { marginTop: 4 },
  fortuneCard: { marginTop: 10 },
  fortuneTitle: { fontSize: 18, fontWeight: '900', color: DrawerTheme.antiqueGold, marginBottom: 12 },
  resultCardContainer: { alignItems: 'center', marginVertical: 15, backgroundColor: 'rgba(7,0,9,0.35)', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(200,163,64,0.18)' },
  resultCardImage: { width: 140, height: 233, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(200,163,64,0.35)' },
  resultCardName: { color: DrawerTheme.goldBright, fontSize: 18, fontWeight: '900', marginTop: 5 },
  resultCardSubName: { color: DrawerTheme.mutedIvory, fontSize: 12, fontWeight: '700', marginTop: 3 },
  summaryText: { color: DrawerTheme.goldBright, fontSize: 16, fontWeight: '900', marginBottom: 10 },
  fortuneContent: { fontSize: 15, lineHeight: 24, color: DrawerTheme.ivory, marginBottom: 18 },
  detailGrid: { gap: 10, marginBottom: 18 },
  detailItem: { backgroundColor: 'rgba(7,0,9,0.28)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(200,163,64,0.14)' },
  detailItemWide: { borderColor: 'rgba(224,193,104,0.22)' },
  detailLabel: { color: DrawerTheme.antiqueGold, fontSize: 12, fontWeight: '900', marginBottom: 5 },
  detailValue: { color: DrawerTheme.ivory, fontSize: 14, lineHeight: 21 },
  fortuneFooter: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: 'rgba(200,163,64,0.18)', paddingTop: 15 },
  fortuneInfo: { alignItems: 'center', flex: 1 },
  infoLabel: { fontSize: 12, color: DrawerTheme.mutedIvory, marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '800', color: DrawerTheme.goldBright, textAlign: 'center' },
  noFortuneCard: { marginTop: 10, alignItems: 'center' },
  noFortuneText: { color: DrawerTheme.mutedIvory, fontSize: 14 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(7,0,9,0.86)' },
  modalCardWrap: { width: '100%', alignItems: 'center' },
  modalStampImage: { width: 260, height: 390, maxWidth: '100%' },
  modalStampName: { marginTop: 16, color: DrawerTheme.ivory, fontSize: 16, fontWeight: '900', textAlign: 'center', letterSpacing: 0.6 },
  modalCloseButton: { alignSelf: 'center', marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,217,119,0.5)', backgroundColor: 'rgba(200,163,64,0.18)' },
  modalCloseText: { color: '#FFD977', fontSize: 13, fontWeight: '900' },
});

export default DailyFortuneScreen;
