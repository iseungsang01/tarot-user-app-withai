import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Animated,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground } from '../../components';
import { Colors } from '../../constants/Colors';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CommonStyles } from '../../styles/CommonStyles';
import { useAuth } from '../../hooks/useAuth';
import { getDailyFortune } from '../../services/aiService';
import { storage } from '../../utils/storage';
import { MAJOR_ARCANA } from '../../constants/TarotCards';

const FORTUNE_SCROLL_AFTER_REPICK_KEY = 'fortune_scroll_after_repick_once';

const DailyFortuneScreen = () => {
    const insets = useSafeAreaInsets();
    const { customer } = useAuth();
    const [loading, setLoading] = useState(true);
    const [checkInLoading, setCheckInLoading] = useState(false);
    const [drawing, setDrawing] = useState(false);
    const [attendanceHistory, setAttendanceHistory] = useState([]);
    const [allFortunes, setAllFortunes] = useState({});
    const [selectedFortune, setSelectedFortune] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [todayCheckedIn, setTodayCheckedIn] = useState(false);
    const [cardRevealed, setCardRevealed] = useState(false);
    const [isPickingCard, setIsPickingCard] = useState(false);
    const [selectedCardIdx, setSelectedCardIdx] = useState(null);
    const [pickedCardData, setPickedCardData] = useState(null);
    const [pendingScrollAfterRepick, setPendingScrollAfterRepick] = useState(false);
    const [fadeAnim] = useState(new Animated.Value(0));
    const [cardAnims] = useState([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]);
    const [flipAnims] = useState([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]);
    const scrollViewRef = useRef(null);

    const scrollToFortuneResult = React.useCallback(() => {
        requestAnimationFrame(() => {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 150);
        });
    }, []);

    const getLocalDateString = (date = new Date()) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const todayStr = getLocalDateString(today);

    useEffect(() => {
        loadLocalData();
    }, [customer]);

    useFocusEffect(
        React.useCallback(() => {
            checkAndScrollAfterRepick();
        }, [])
    );

    useEffect(() => {
        // 카드 선택 화면에서 즉시 앞면이 보이도록 이미지 캐시를 미리 준비
        MAJOR_ARCANA.forEach((card) => {
            if (card?.image) {
                Image.prefetch(card.image);
            }
        });
    }, []);

    const loadLocalData = async () => {
        setLoading(true);
        try {
            const shouldScrollAfterRepick = await storage.get(FORTUNE_SCROLL_AFTER_REPICK_KEY);
            setPendingScrollAfterRepick(!!shouldScrollAfterRepick);

            // 1. 로컬 운세 데이터 로드
            const fortunes = await storage.getAllFortunes();
            setAllFortunes(fortunes || {});

            // 2. 로컬 출석 데이터 로드
            const history = await storage.getAttendanceHistory();
            setAttendanceHistory(history || []);

            const hasToday = (history || []).includes(todayStr);
            setTodayCheckedIn(hasToday);

            // 오늘 날짜의 운세가 있으면 기본으로 보여줌
            if (fortunes && fortunes[todayStr]) {
                setSelectedFortune(fortunes[todayStr]);
                setSelectedDate(todayStr);
                setCardRevealed(true);

            } else {
                setSelectedDate(todayStr);
                setCardRevealed(false);
            }
        } catch (error) {
            console.error('Local data load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkAndScrollAfterRepick = async () => {
        const shouldScrollAfterRepick = await storage.get(FORTUNE_SCROLL_AFTER_REPICK_KEY);
        setPendingScrollAfterRepick(!!shouldScrollAfterRepick);
    };

    useEffect(() => {
        if (!pendingScrollAfterRepick || !selectedFortune || !cardRevealed) return;

        scrollToFortuneResult();
        setPendingScrollAfterRepick(false);
        storage.remove(FORTUNE_SCROLL_AFTER_REPICK_KEY);
    }, [pendingScrollAfterRepick, selectedFortune, cardRevealed, scrollToFortuneResult]);

    const isErrorFortune = (fortune) => {
        if (!fortune || !fortune.fortune) return false;
        const content = fortune.fortune;
        return content.includes('오류') || content.includes('초과') || content.includes('부족') || content.includes('Error');
    };
    const hasValidFortune = (fortune) => !!fortune && !isErrorFortune(fortune);

    const handleCheckIn = async (isRepick = false) => {
        const currentFortune = allFortunes[todayStr];
        if (!isRepick && hasValidFortune(currentFortune)) {
            return;
        }
        setIsPickingCard(true);
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
        }).start();

        cardAnims.forEach((anim, i) => {
            anim.setValue(0);
            Animated.spring(anim, {
                toValue: 1,
                delay: i * 50,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            }).start();
        });

        if (isRepick) {
            await storage.save(FORTUNE_SCROLL_AFTER_REPICK_KEY, true);
            setSelectedFortune(null);
            setCardRevealed(false);
            setPickedCardData(null);
            flipAnims.forEach(anim => anim.setValue(0));
        }
        return;

    };

    const onSelectCard = (idx) => {
        if (drawing) return;
        setSelectedCardIdx(idx);
        onPickCard(idx);
    };

    const onPickCard = async (idx) => {
        if (drawing) return;
        const currentIdx = idx !== undefined ? idx : selectedCardIdx;
        if (currentIdx === null) return;

        setDrawing(true);
        setCheckInLoading(true);

        try {
            const randomCard = MAJOR_ARCANA[Math.floor(Math.random() * MAJOR_ARCANA.length)];
            setPickedCardData(randomCard);

            Animated.spring(flipAnims[currentIdx], {
                toValue: 1,
                useNativeDriver: true,
                friction: 9,
                tension: 60,
            }).start();

            const initialFortuneState = {
                cardName: randomCard.nameKr,
                cardImage: randomCard.image,
                fortune: null,
                luckyColor: null,
                luckyItem: null
            };

            setTimeout(() => {
                setSelectedFortune(initialFortuneState);
                setSelectedDate(todayStr);
                setCardRevealed(true);
                setIsPickingCard(false);
            }, 200);

            const nickname = customer.nickname || '귀한 손님';
            const currentFortune = allFortunes[todayStr];
            const prevContent = hasValidFortune(currentFortune) ? currentFortune.fortune : '';

            const [fortuneResult] = await Promise.all([
                getDailyFortune(nickname, prevContent, randomCard.name),
                !todayCheckedIn ? storage.saveAttendance(todayStr) : Promise.resolve()
            ]);

            if (!todayCheckedIn) {
                setTodayCheckedIn(true);
                setAttendanceHistory(prev => [...new Set([...prev, todayStr])]);
            }

            if (fortuneResult.error) throw fortuneResult.error;

            const finalFortune = {
                ...fortuneResult.data,
                cardName: randomCard.nameKr,
                cardImage: randomCard.image
            };

            await storage.saveDailyFortune(finalFortune, todayStr);
            setAllFortunes(prev => ({ ...prev, [todayStr]: finalFortune }));
            setSelectedFortune(finalFortune);

        } catch (error) {
            console.error('Pick card error:', error);
            Alert.alert('오류', '운세를 가져오는 중 문제가 발생했습니다.');
            setIsPickingCard(false);
        } finally {
            setDrawing(false);
            setCheckInLoading(false);
            setSelectedCardIdx(null);
            setPickedCardData(null);
        }
    };

    const handleDatePress = (dateStr) => {
        const fortuneForDay = allFortunes[dateStr];
        setSelectedFortune(fortuneForDay || null);
        setSelectedDate(dateStr);
        setCardRevealed(!!fortuneForDay);
    };

    const calendarGrid = React.useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<View key={`empty-${i}`} style={styles.dayBox} />);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
            const isAttended = attendanceHistory.includes(dateStr);
            const isToday = todayStr === dateStr;
            const fortuneForDay = allFortunes[dateStr];
            const hasFortune = hasValidFortune(fortuneForDay);
            const isSelected = selectedDate === dateStr;

            days.push(
                <TouchableOpacity
                    key={d}
                    style={styles.dayBox}
                    onPress={() => handleDatePress(dateStr)}
                    activeOpacity={0.7}
                >
                    <View style={[
                        styles.dayCircle,
                        isAttended && styles.attendedCircle,
                        isToday && styles.todayCircle,
                        isSelected && styles.selectedCircle,
                    ]}>
                        <Text style={[
                            styles.dayText,
                            isAttended && styles.attendedText,
                            isToday && styles.todayText,
                            isSelected && styles.selectedText,
                        ]}>{d}</Text>
                    </View>
                    {isAttended && <Text style={styles.checkEmoji}>🍀</Text>}
                    {hasFortune && !isAttended && <Text style={styles.checkEmoji}>🔮</Text>}
                </TouchableOpacity>
            );
        }

        return (
            <View style={styles.calendarGrid}>
                {['일', '월', '화', '수', '목', '금', '토'].map(w => (
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

    return (
        <GradientBackground>
            <ScrollView
                ref={scrollViewRef}
                style={styles.container}
                contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }}
            >
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>{isPickingCard ? 'PICK YOUR CARD' : 'FORTUNE BOARD'}</Text>
                    </View>
                    <View style={styles.headerDivider} />
                    <Text style={styles.subtitle}>
                        {isPickingCard ? '오늘 당신의 운명이 담긴 카드를 골라보세요' : `${currentYear}년 ${currentMonth + 1}월 오늘의 운세를 확인하세요`}
                    </Text>
                </View>

                {!isPickingCard && (
                    <View style={styles.card}>
                        {loading ? (
                            <ActivityIndicator color={Colors.gold} size="large" style={{ marginVertical: 40 }} />
                        ) : (
                            calendarGrid
                        )}
                    </View>
                )}

                <View style={styles.actionSection}>
                    {selectedDate === todayStr ? (
                        <View style={{ gap: 12 }}>
                            {isPickingCard ? (
                                <Animated.View style={[styles.cardPickerContainer, { opacity: fadeAnim }]}>
                                    <Text style={styles.pickerTitle}>마음이 끌리는 카드를 선택하세요</Text>
                                    <View style={styles.cardRow}>
                                        {[0, 1, 2].map((idx) => {
                                            const rotateY = flipAnims[idx].interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0deg', '180deg']
                                            });

                                            return (
                                                <Animated.View
                                                    key={idx}
                                                    style={{
                                                        width: '30%',
                                                        transform: [
                                                            {
                                                                translateY: cardAnims[idx].interpolate({
                                                                    inputRange: [0, 1],
                                                                    outputRange: [50, 0]
                                                                })
                                                            },
                                                            { scale: selectedCardIdx === idx ? 1.1 : 1 },
                                                            { rotateY: rotateY }
                                                        ]
                                                    }}
                                                >
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.tarotCard,
                                                            selectedCardIdx === idx && styles.selectedTarotCard,
                                                            drawing && selectedCardIdx !== idx && { opacity: 0.5 }
                                                        ]}
                                                        onPress={() => onSelectCard(idx)}
                                                        disabled={drawing}
                                                    >
                                                        {/* 카드 앞면 (이미지) */}
                                                        <Animated.View style={[
                                                            styles.cardFront,
                                                            { transform: [{ rotateY: '180deg' }] }
                                                        ]}>
                                                            {pickedCardData ? (
                                                                <Image
                                                                    source={{ uri: pickedCardData.image }}
                                                                    style={styles.cardImageInner}
                                                                    resizeMode="cover"
                                                                />
                                                            ) : (
                                                                <View style={styles.cardFrontPlaceholder} />
                                                            )}
                                                        </Animated.View>

                                                        {/* 카드 뒷면 (패턴) */}
                                                        <Animated.View style={[
                                                            styles.cardBack,
                                                            {
                                                                opacity: flipAnims[idx].interpolate({
                                                                    inputRange: [0, 0.5, 0.51, 1],
                                                                    outputRange: [1, 1, 0, 0]
                                                                })
                                                            }
                                                        ]}>
                                                            <LinearGradient
                                                                colors={['#2d004d', '#1a0033']}
                                                                style={styles.cardBackGradient}
                                                            >
                                                                <View style={styles.cardPattern}>
                                                                    <View style={styles.innerPattern}>
                                                                        <Text style={styles.cardPatternText}>✨</Text>
                                                                    </View>
                                                                </View>
                                                            </LinearGradient>
                                                        </Animated.View>
                                                    </TouchableOpacity>
                                                </Animated.View>
                                            );
                                        })}
                                    </View>
                                    {/* Reveal 버튼 제거 - 클릭 즉시 진행됨 */}
                                    {drawing && (
                                        <View style={styles.drawingStatus}>
                                            <ActivityIndicator color={Colors.gold} size="small" />
                                            <Text style={styles.drawingText}>운명의 카드를 해석하는 중...</Text>
                                        </View>
                                    )}
                                    {!drawing && (
                                        <TouchableOpacity
                                            style={styles.cancelPick}
                                            onPress={() => setIsPickingCard(false)}
                                        >
                                            <Text style={styles.cancelPickText}>돌아가기</Text>
                                        </TouchableOpacity>
                                    )}
                                </Animated.View>
                            ) : (
                                <>
                                    {!hasFortuneToday && !isTodayError && (
                                        <View style={styles.doneBanner}>
                                            <Text style={styles.doneText}>카드를 뽑아 오늘의 운세를 확인해보세요 ✨</Text>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        onPress={() => handleCheckIn(hasFortuneToday && !isTodayError)}
                                        disabled={drawing}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={
                                                isTodayError
                                                    ? [Colors.lavender, '#CBA6F7']
                                                    : (hasFortuneToday && !isTodayError
                                                        ? ['#1a1a1a', '#0a0a0a'] // 더 어두운 블랙
                                                        : ['#FFD700', '#FDB931', '#D4AF37'])
                                            }
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={[
                                                styles.drawCard,
                                                (hasFortuneToday && !isTodayError) ? styles.repickButton : styles.normalButton,
                                                (hasFortuneToday && !isTodayError) && { shadowColor: '#000' }
                                            ]}
                                        >
                                            {checkInLoading ? (
                                                <ActivityIndicator color={hasFortuneToday && !isTodayError ? "#FFF" : "#000"} />
                                            ) : (
                                                <>
                                                    <Text style={styles.cardIcon}>{(hasFortuneToday && !isTodayError) ? '🔄' : '🃏'}</Text>
                                                    <Text style={[
                                                        styles.checkInButtonText,
                                                        (hasFortuneToday && !isTodayError) && { color: '#FFF' }
                                                    ]}>
                                                        {isTodayError
                                                            ? '운세 카드 다시 뽑기'
                                                            : (hasFortuneToday && !isTodayError
                                                                ? '카드 다시 뽑기'
                                                                : (todayCheckedIn ? '오늘의 운세 카드 열기' : '오늘의 운세 카드 뽑기'))
                                                        }
                                                    </Text>
                                                </>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>


                                </>
                            )}
                        </View>
                    ) : selectedDate && selectedDate !== todayStr ? (
                        <View style={styles.doneBanner}>
                            <Text style={styles.doneText}>{selectedDate.split('-')[2]}일의 기록을 보고 있습니다</Text>
                        </View>
                    ) : null}
                </View>

                {selectedFortune && cardRevealed && (
                    <View style={styles.fortuneCard}>
                        <Text style={styles.fortuneTitle}>🔮 {selectedDate === todayStr ? '오늘' : selectedDate.split('-')[1] + '월 ' + selectedDate.split('-')[2] + '일'}의 운세</Text>

                        {selectedFortune.cardImage && (
                            <View style={styles.resultCardContainer}>
                                <Image
                                    source={{ uri: selectedFortune.cardImage }}
                                    style={styles.resultCardImage}
                                    resizeMode="contain"
                                />
                                <Text style={styles.resultCardName}>{selectedFortune.cardName}</Text>
                            </View>
                        )}

                        {selectedFortune?.fortune ? (
                            <Text style={styles.fortuneContent}>{selectedFortune.fortune}</Text>
                        ) : (
                            <View style={styles.loadingFortuneText}>
                                <ActivityIndicator size="small" color={Colors.gold} />
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
                    </View>
                )}

                {selectedDate && !selectedFortune && selectedDate !== todayStr && (
                    <View style={styles.noFortuneCard}>
                        <Text style={styles.noFortuneText}>이 날은 저장된 운세가 없습니다.</Text>
                    </View>
                )}
            </ScrollView>
        </GradientBackground >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    header: CommonStyles.headerBoard,
    titleRow: CommonStyles.titleRow,
    title: CommonStyles.title,
    headerDivider: CommonStyles.headerDivider,
    subtitle: CommonStyles.subtitle,
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
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
        color: Colors.lavender,
        fontSize: 12,
        fontWeight: '600',
        opacity: 0.6,
    },
    dayCircle: {
        width: '80%',
        height: '80%',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayText: {
        color: '#FFF',
        fontSize: 14,
    },
    attendedCircle: {
        backgroundColor: 'rgba(180, 140, 255, 0.2)',
    },
    attendedText: {
        color: Colors.gold,
        fontWeight: 'bold',
    },
    todayCircle: {
        borderWidth: 2,
        borderColor: Colors.gold,
    },
    todayText: {
        fontWeight: '900',
    },
    selectedCircle: {
        backgroundColor: Colors.gold,
    },
    selectedText: {
        color: '#000',
        fontWeight: 'bold',
    },
    checkEmoji: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        fontSize: 12,
    },
    actionSection: {
        marginTop: 25,
        marginBottom: 20,
    },
    drawCard: {
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1.5,
        elevation: 5,
    },
    normalButton: {
        backgroundColor: Colors.gold,
        borderColor: 'rgba(212, 175, 55, 0.5)',
        shadowColor: Colors.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    repickButton: {
        backgroundColor: '#1a1a1a',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        paddingVertical: 10,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    checkInButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '800',
    },
    cardIcon: {
        fontSize: 26,
    },
    doneBanner: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 15,
        paddingVertical: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    doneText: {
        color: Colors.gold,
        fontSize: 16,
        fontWeight: '700',
    },
    fortuneCard: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: DrawerTheme.goldBright,
        marginTop: 10,
    },
    fortuneTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.gold,
        marginBottom: 12,
    },
    fortuneContent: {
        fontSize: 15,
        lineHeight: 24,
        color: '#FFF',
        opacity: 0.9,
        marginBottom: 20,
    },
    fortuneFooter: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        paddingTop: 15,
    },
    fortuneInfo: {
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 12,
        color: Colors.lavender,
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.gold,
    },
    guestCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    guestEmoji: {
        fontSize: 40,
        marginBottom: 15,
    },
    guestTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.gold,
        marginBottom: 10,
    },
    guestSubtitle: {
        fontSize: 14,
        color: Colors.lavender,
        textAlign: 'center',
        lineHeight: 20,
        opacity: 0.8,
    },
    noFortuneCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 15,
        padding: 20,
        marginTop: 10,
        alignItems: 'center',
    },
    noFortuneText: {
        color: Colors.lavender,
        fontSize: 14,
        opacity: 0.6,
    },
    cardPickerContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    pickerTitle: {
        color: Colors.gold,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 25,
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        paddingHorizontal: 10,
    },
    tarotCard: {
        width: '100%',
        aspectRatio: 0.6,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.4)',
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    selectedTarotCard: {
        borderColor: Colors.gold,
        borderWidth: 2,
        shadowColor: Colors.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 15,
        elevation: 15,
    },
    cardBack: {
        ...StyleSheet.absoluteFillObject,
        backfaceVisibility: 'hidden',
    },
    cardBackGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 6,
    },
    cardFront: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#1A0033',
        backfaceVisibility: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardImageInner: {
        width: '100%',
        height: '100%',
    },
    cardFrontPlaceholder: {
        flex: 1,
        backgroundColor: '#2d004d',
    },
    cardPattern: {
        width: '100%',
        height: '100%',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        borderRadius: 8,
        padding: 4,
    },
    innerPattern: {
        flex: 1,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.1)',
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    cardPatternText: {
        fontSize: 28,
        color: Colors.gold,
        opacity: 0.8,
        textShadowColor: 'rgba(212, 175, 55, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    loadingFortuneText: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 15,
        borderRadius: 12,
        marginBottom: 20,
    },
    interpretingText: {
        color: Colors.gold,
        fontSize: 14,
        fontWeight: '600',
        fontStyle: 'italic',
    },
    drawingStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 30,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        gap: 10,
    },
    drawingText: {
        color: Colors.gold,
        fontSize: 14,
        fontWeight: '600',
    },
    revealButton: {
        marginTop: 35,
        backgroundColor: Colors.gold,
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 25,
        shadowColor: Colors.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    revealButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelPick: {
        marginTop: 30,
        padding: 10,
    },
    cancelPickText: {
        color: Colors.lavender,
        fontSize: 14,
        textDecorationLine: 'underline',
        opacity: 0.7,
    },
    resultCardContainer: {
        alignItems: 'center',
        marginVertical: 15,
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: 15,
        borderRadius: 15,
    },
    resultCardImage: {
        width: 140, // 너비 약간 증가
        height: 233, // 0.6 비율 유지
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    resultCardName: {
        color: Colors.gold,
        fontSize: 18, // 폰트 크기 증가
        fontWeight: 'bold',
        marginTop: 5,
    },
});

export default DailyFortuneScreen;
