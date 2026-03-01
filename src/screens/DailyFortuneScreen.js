import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground } from '../components';
import { Colors } from '../constants/Colors';
import { DrawerTheme } from '../constants/DrawerTheme';
import { CommonStyles } from '../styles/CommonStyles';
import { useAuth } from '../hooks/useAuth';
import { getDailyFortune } from '../services/aiService';
import { storage } from '../utils/storage';

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

    const getLocalDateString = (date = new Date()) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const isGuest = customer?.isGuest || customer?.id === 'guest';
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const todayStr = getLocalDateString(today);

    useEffect(() => {
        loadLocalData();
    }, [customer]);

    const loadLocalData = async () => {
        setLoading(true);
        try {
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

    const isErrorFortune = (fortune) => {
        if (!fortune || !fortune.fortune) return false;
        const content = fortune.fortune;
        return content.includes('오류') || content.includes('초과') || content.includes('부족') || content.includes('Error');
    };

    const handleCheckIn = async (isRepick = false) => {
        // 게스트도 이용 가능하도록 수정
        // if (isGuest) {
        //     Alert.alert('로그인 필요', '회원만 이용 가능합니다.', [{ text: '확인' }]);
        //     return;
        // }

        // 이미 정상적인 운세가 있으면 중단 (isRepick이 아니거나 오류가 아닌 경우만)
        const currentFortune = allFortunes[todayStr];
        if (!isRepick && currentFortune && !isErrorFortune(currentFortune)) {
            return;
        }
        setDrawing(true);
        if (isRepick) {
            setCheckInLoading(true);
            setSelectedFortune(null);
        }
        setCardRevealed(false);

        try {
            if (isRepick) {
                // 광고 보기 시뮬레이션 (2초 대기)
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // 1. 출석 기록 저장 (이미 했으면 건너뜀)
            if (!todayCheckedIn) {
                await storage.saveAttendance(todayStr);
                setTodayCheckedIn(true);
                setAttendanceHistory(prev => [...new Set([...prev, todayStr])]);
            }

            // 2. 오늘의 운세 가져오기
            const nickname = customer.nickname || '귀한 손님';
            const prevContent = isRepick && currentFortune ? currentFortune.fortune : '';
            const { data, error: fortuneError } = await getDailyFortune(nickname, prevContent);

            if (fortuneError) throw fortuneError;

            // 3. 로컬 운세 저장 및 상태 업데이트
            await storage.saveDailyFortune(data, todayStr);
            setAllFortunes(prev => ({ ...prev, [todayStr]: data }));
            setSelectedFortune(data);
            setSelectedDate(todayStr);
            setCardRevealed(true);
        } catch (error) {
            console.error('Check-in error:', error);
            Alert.alert('오류', '운세를 가져오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
            // 실패 시 기존 운세 복구 (선택 사항)
            if (isRepick && currentFortune) {
                setSelectedFortune(currentFortune);
                setCardRevealed(true);
            }
        } finally {
            setDrawing(false);
            setCheckInLoading(false);
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
            const hasFortune = !!fortuneForDay && !isErrorFortune(fortuneForDay);
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
    const hasFortuneToday = !!todayFortune && !!todayFortune.fortune && !isErrorFortune(todayFortune);
    const isTodayError = !!todayFortune && isErrorFortune(todayFortune);

    return (
        <GradientBackground>
            <ScrollView
                style={styles.container}
                contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }}
            >
                <View style={styles.header}>
                    <View style={styles.titleRow}><Text style={styles.title}>FORTUNE BOARD</Text></View>
                    <View style={styles.headerDivider} />
                    <Text style={styles.subtitle}>{currentYear}년 {currentMonth + 1}월 오늘의 운세를 확인하세요</Text>
                </View>

                <View style={styles.card}>
                    {loading ? (
                        <ActivityIndicator color={Colors.gold} size="large" style={{ marginVertical: 40 }} />
                    ) : (
                        calendarGrid
                    )}
                </View>

                <View style={styles.actionSection}>
                    {selectedDate === todayStr ? (
                        <View style={{ gap: 12 }}>
                            {!hasFortuneToday && !isTodayError && (
                                <View style={styles.doneBanner}>
                                    <Text style={styles.doneText}>카드를 뽑아 오늘의 운세를 확인해보세요 ✨</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[
                                    styles.drawCard,
                                    (hasFortuneToday && !isTodayError) && {
                                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                        borderWidth: 1.5,
                                        borderColor: Colors.gold,
                                    },
                                    isTodayError && { backgroundColor: Colors.lavender }
                                ]}
                                onPress={() => handleCheckIn(hasFortuneToday && !isTodayError)}
                                disabled={drawing}
                                activeOpacity={0.8}
                            >
                                {checkInLoading ? (
                                    <ActivityIndicator color={hasFortuneToday && !isTodayError ? Colors.gold : "#000"} />
                                ) : (
                                    <>
                                        <Text style={styles.cardIcon}>{(hasFortuneToday && !isTodayError) ? '✨' : '🃏'}</Text>
                                        <Text style={[
                                            styles.checkInButtonText,
                                            (hasFortuneToday && !isTodayError) && { color: Colors.gold, fontSize: 16 }
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
                            </TouchableOpacity>

                            {hasFortuneToday && !isTodayError && cardRevealed && (
                                <View style={styles.doneBanner}>
                                    <Text style={styles.doneText}>카드 확인 완료! 아래에서 오늘의 운세를 확인하세요.</Text>
                                </View>
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
                        <Text style={styles.fortuneContent}>{selectedFortune?.fortune || '운세 내용을 불러오지 못했습니다. 다시 시도해주세요.'}</Text>
                        <View style={styles.fortuneFooter}>
                            <View style={styles.fortuneInfo}>
                                <Text style={styles.infoLabel}>행운의 색</Text>
                                <Text style={styles.infoValue}>{selectedFortune?.luckyColor || '-'}</Text>
                            </View>
                            <View style={styles.fortuneInfo}>
                                <Text style={styles.infoLabel}>행운의 아이템</Text>
                                <Text style={styles.infoValue}>{selectedFortune?.luckyItem || '-'}</Text>
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
        backgroundColor: Colors.gold,
        borderRadius: 18,
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.2)',
        shadowColor: Colors.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    checkInButtonText: {
        color: '#000',
        fontSize: 18,
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
});

export default DailyFortuneScreen;
