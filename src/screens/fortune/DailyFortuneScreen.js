import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoldActionButton, PremiumCard, PremiumHeaderPanel, ScreenContainer } from '../../components';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { useAuth } from '../../hooks/useAuth';
import { getDailyFortune } from '../../services/aiService';
import { storage } from '../../utils/storage';
import { MAJOR_ARCANA } from '../../constants/TarotCards';

const FORTUNE_SCROLL_AFTER_REPICK_KEY = 'fortune_scroll_after_repick_once';

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isErrorFortune = (fortune) => {
  if (!fortune?.fortune) return false;
  const content = fortune.fortune;
  return content.includes('오류') || content.includes('초과') || content.includes('부족') || content.includes('Error');
};

const hasValidFortune = (fortune) => !!fortune && !isErrorFortune(fortune);

const DailyFortuneScreen = () => {
  const insets = useSafeAreaInsets();
  const { customer } = useAuth();
  const [loading, setLoading] = useState(true);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [allFortunes, setAllFortunes] = useState({});
  const [selectedFortune, setSelectedFortune] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [todayCheckedIn, setTodayCheckedIn] = useState(false);
  const [isPickingCard, setIsPickingCard] = useState(false);

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const todayStr = getLocalDateString(today);

  const loadLocalData = useCallback(async () => {
    setLoading(true);
    try {
      await storage.get(FORTUNE_SCROLL_AFTER_REPICK_KEY);
      const fortunes = await storage.getAllFortunes();
      const history = await storage.getAttendanceHistory();
      const safeFortunes = fortunes || {};
      const safeHistory = history || [];

      setAllFortunes(safeFortunes);
      setAttendanceHistory(safeHistory);
      setTodayCheckedIn(safeHistory.includes(todayStr));
      setSelectedDate(todayStr);
      setSelectedFortune(safeFortunes[todayStr] || null);
      await storage.remove(FORTUNE_SCROLL_AFTER_REPICK_KEY);
    } catch (error) {
      console.error('Local data load error:', error);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadLocalData();
  }, [customer, loadLocalData]);

  useFocusEffect(
    useCallback(() => {
      loadLocalData();
    }, [loadLocalData])
  );

  useEffect(() => {
    MAJOR_ARCANA.forEach((card) => {
      if (card?.image) Image.prefetch(card.image);
    });
  }, []);

  const handleDrawCard = async (isRepick = false) => {
    const currentFortune = allFortunes[todayStr];
    if (!isRepick && hasValidFortune(currentFortune)) return;

    setCheckInLoading(true);
    try {
      const randomCard = MAJOR_ARCANA[Math.floor(Math.random() * MAJOR_ARCANA.length)];
      const initialFortuneState = {
        cardName: randomCard.nameKr,
        cardImage: randomCard.image,
        fortune: null,
        luckyColor: null,
        luckyItem: null,
      };
      setSelectedDate(todayStr);
      setSelectedFortune(initialFortuneState);

      const nickname = customer?.nickname || '고객님';
      const prevContent = hasValidFortune(currentFortune) ? currentFortune.fortune : '';
      const [fortuneResult] = await Promise.all([
        getDailyFortune(nickname, prevContent, randomCard.name, { countUsage: isRepick }),
        !todayCheckedIn ? storage.saveAttendance(todayStr) : Promise.resolve(),
      ]);

      if (!todayCheckedIn) {
        setTodayCheckedIn(true);
        setAttendanceHistory((prev) => [...new Set([...prev, todayStr])]);
      }

      if (fortuneResult.error) throw fortuneResult.error;

      const finalFortune = {
        ...fortuneResult.data,
        cardName: randomCard.nameKr,
        cardImage: randomCard.image,
      };

      await storage.saveDailyFortune(finalFortune, todayStr);
      setAllFortunes((prev) => ({ ...prev, [todayStr]: finalFortune }));
      setSelectedFortune(finalFortune);
      setIsPickingCard(false);
    } catch (error) {
      console.error('Pick card error:', error);
      if (!error?.isAuthError && !error?.requiresReLogin) {
        Alert.alert('오류', '운세를 가져오는 중 문제가 발생했습니다.');
      }
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleDatePress = (dateStr) => {
    const fortuneForDay = allFortunes[dateStr];
    setSelectedFortune(fortuneForDay || null);
    setSelectedDate(dateStr);
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
          {isAttended && <View style={styles.fortuneMarker} />}
          {hasFortune && !isAttended && <View style={styles.fortuneMarkerDim} />}
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.calendarGrid}>
        {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
          <View key={w} style={styles.dayBox}>
            <Text style={styles.weekdayText}>{w}</Text>
          </View>
        ))}
        {days}
      </View>
    );
  }, [currentYear, currentMonth, attendanceHistory, allFortunes, selectedDate, todayStr]);

  const todayFortune = allFortunes[todayStr];
  const hasFortuneToday = !!todayFortune?.fortune && hasValidFortune(todayFortune);
  const isTodayError = !!todayFortune && isErrorFortune(todayFortune);
  const isSelectedToday = selectedDate === todayStr;

  return (
    <ScreenContainer safeTop={false} safeBottom={false}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <PremiumHeaderPanel
          title="FORTUNE BOARD"
          subtitle={`${currentYear}년 ${currentMonth + 1}월의 오늘의 운세를 확인하세요`}
          compact
          style={styles.header}
        />

        <PremiumCard style={styles.card}>
          {loading ? <ActivityIndicator color={DrawerTheme.antiqueGold} size="large" style={{ marginVertical: 40 }} /> : calendarGrid}
        </PremiumCard>

        <View style={styles.actionSection}>
          {isSelectedToday ? (
            <>
              {!hasFortuneToday && !isTodayError && !selectedFortune && (
                <View style={styles.doneBanner}>
                  <Text style={styles.doneText}>카드를 열어 오늘의 메시지를 확인해보세요</Text>
                </View>
              )}

              <GoldActionButton
                onPress={() => setIsPickingCard(true)}
                disabled={checkInLoading}
                dark={hasFortuneToday && !isTodayError}
                style={styles.drawButton}
              >
                {checkInLoading
                  ? '해석 중...'
                  : isTodayError
                    ? '카드 다시 뽑기'
                    : hasFortuneToday
                      ? '카드 다시 뽑기'
                      : '오늘의 카드 뽑기'}
              </GoldActionButton>
            </>
          ) : selectedDate ? (
            <View style={styles.doneBanner}>
              <Text style={styles.doneText}>{selectedDate.split('-')[2]}일의 기록을 보고 있습니다</Text>
            </View>
          ) : null}
        </View>

        {isPickingCard && (
          <PremiumCard style={styles.pickerPanel}>
            <Text style={styles.pickerTitle}>오늘의 카드를 선택하세요</Text>
            <View style={styles.cardRow}>
              {[0, 1, 2].map((idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.84}
                  style={styles.tarotCardBack}
                  onPress={() => handleDrawCard(hasFortuneToday && !isTodayError)}
                  disabled={checkInLoading}
                >
                  <LinearGradient colors={['#3B0B24', '#09000D']} style={styles.cardBackGradient}>
                    <View style={styles.cardPattern}>
                      <View style={styles.innerPattern}>
                        <Text style={styles.cardPatternText}>T</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setIsPickingCard(false)} style={styles.cancelPick}>
              <Text style={styles.cancelPickText}>돌아가기</Text>
            </TouchableOpacity>
          </PremiumCard>
        )}

        {selectedFortune && (
          <PremiumCard style={styles.fortuneCard}>
            <Text style={styles.fortuneTitle}>{selectedDate === todayStr ? '오늘' : `${selectedDate?.split('-')[1]}월 ${selectedDate?.split('-')[2]}일`}의 카드 기록</Text>

            {selectedFortune.cardImage && (
              <View style={styles.resultCardContainer}>
                <Image source={{ uri: selectedFortune.cardImage }} style={styles.resultCardImage} resizeMode="contain" />
                <Text style={styles.resultCardName}>{selectedFortune.cardName}</Text>
              </View>
            )}

            {selectedFortune?.fortune ? (
              <Text style={styles.fortuneContent}>{selectedFortune.fortune}</Text>
            ) : (
              <View style={styles.loadingFortuneText}>
                <ActivityIndicator size="small" color={DrawerTheme.antiqueGold} />
                <Text style={styles.interpretingText}>운명의 메시지를 해석하는 중...</Text>
              </View>
            )}

            <View style={styles.fortuneFooter}>
              <View style={styles.fortuneInfo}>
                <Text style={styles.infoLabel}>행운의 색</Text>
                <Text style={styles.infoValue}>{selectedFortune?.luckyColor || '...'}</Text>
              </View>
              <View style={styles.fortuneInfo}>
                <Text style={styles.infoLabel}>행운의 아이템</Text>
                <Text style={styles.infoValue}>{selectedFortune?.luckyItem || '...'}</Text>
              </View>
            </View>
          </PremiumCard>
        )}

        {selectedDate && !selectedFortune && selectedDate !== todayStr && (
          <PremiumCard style={styles.noFortuneCard}>
            <Text style={styles.noFortuneText}>이 날짜에는 저장된 카드 기록이 없습니다.</Text>
          </PremiumCard>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 16,
  },
  card: {
    padding: 15,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayBox: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
    position: 'relative',
  },
  weekdayText: {
    color: DrawerTheme.mutedIvory,
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.8,
  },
  dayCircle: {
    width: '80%',
    height: '80%',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(7,0,9,0.38)',
  },
  dayText: {
    color: DrawerTheme.ivory,
    fontSize: 14,
    fontWeight: '600',
  },
  attendedCircle: {
    backgroundColor: 'rgba(200,163,64,0.12)',
  },
  attendedText: {
    color: DrawerTheme.goldBright,
    fontWeight: '900',
  },
  todayCircle: {
    borderWidth: 2,
    borderColor: DrawerTheme.antiqueGold,
  },
  todayText: {
    fontWeight: '900',
  },
  selectedCircle: {
    backgroundColor: DrawerTheme.antiqueGold,
  },
  selectedText: {
    color: DrawerTheme.bgBlackCherry,
    fontWeight: '900',
  },
  fortuneMarker: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DrawerTheme.antiqueGold,
    borderWidth: 1,
    borderColor: DrawerTheme.bgBlackCherry,
  },
  fortuneMarkerDim: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DrawerTheme.antiqueGold,
    backgroundColor: 'rgba(200,163,64,0.18)',
  },
  actionSection: {
    marginTop: 20,
    marginBottom: 12,
    gap: 12,
  },
  drawButton: {
    marginTop: 4,
  },
  pickerPanel: {
    marginBottom: 14,
    alignItems: 'center',
  },
  pickerTitle: {
    color: DrawerTheme.goldBright,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 16,
    textAlign: 'center',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  tarotCardBack: {
    flex: 1,
    aspectRatio: 0.64,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.45)',
    backgroundColor: DrawerTheme.bgBlackCherry,
  },
  cardBackGradient: {
    flex: 1,
    padding: 7,
  },
  cardPattern: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.28)',
    borderRadius: 10,
    padding: 5,
  },
  innerPattern: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.18)',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,0,9,0.28)',
  },
  cardPatternText: {
    color: DrawerTheme.antiqueGold,
    fontSize: 28,
    fontWeight: '900',
    opacity: 0.82,
  },
  cancelPick: {
    marginTop: 16,
    padding: 8,
  },
  cancelPickText: {
    color: DrawerTheme.mutedIvory,
    fontSize: 13,
    fontWeight: '700',
  },
  doneBanner: {
    backgroundColor: 'rgba(31,18,12,0.55)',
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.28)',
  },
  doneText: {
    color: DrawerTheme.ivory,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  fortuneCard: {
    marginTop: 10,
  },
  fortuneTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: DrawerTheme.antiqueGold,
    marginBottom: 12,
  },
  fortuneContent: {
    fontSize: 15,
    lineHeight: 24,
    color: DrawerTheme.ivory,
    marginBottom: 20,
  },
  fortuneFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,163,64,0.18)',
    paddingTop: 15,
  },
  fortuneInfo: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: DrawerTheme.mutedIvory,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '800',
    color: DrawerTheme.goldBright,
  },
  noFortuneCard: {
    marginTop: 10,
    alignItems: 'center',
  },
  noFortuneText: {
    color: DrawerTheme.mutedIvory,
    fontSize: 14,
  },
  resultCardContainer: {
    alignItems: 'center',
    marginVertical: 15,
    backgroundColor: 'rgba(7,0,9,0.35)',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.18)',
  },
  resultCardImage: {
    width: 140,
    height: 233,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.35)',
  },
  resultCardName: {
    color: DrawerTheme.goldBright,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 5,
  },
  loadingFortuneText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(7,0,9,0.35)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  interpretingText: {
    color: DrawerTheme.goldBright,
    fontSize: 14,
    fontWeight: '700',
    fontStyle: 'italic',
  },
});

export default DailyFortuneScreen;
