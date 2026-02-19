/**
 * src/screens/AIChatScreen.js
 * AI 타로 상담사 챗봇 화면
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground } from '../components';
import { useAIChat } from '../hooks/useOpenAI';
import { useAuth } from '../hooks/useAuth';
import { DrawerTheme } from '../constants/DrawerTheme';

// ─────────────────────────────────────────────────────────────
// 서브 컴포넌트: 채팅 말풍선
// ─────────────────────────────────────────────────────────────

const ChatBubble = ({ message }) => {
    const isUser = message.role === 'user';

    // 타임스탬프 처리 (Date 객체가 아닐 경우 변환 시도)
    let timeStr = '';
    if (message.timestamp) {
        const date = typeof message.timestamp === 'string'
            ? new Date(message.timestamp)
            : message.timestamp;

        if (date instanceof Date && !isNaN(date)) {
            timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
    }

    return (
        <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
            {!isUser && (
                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarEmoji}>🖋️</Text>
                </View>
            )}
            <View style={styles.bubbleWrapper}>
                <View style={[
                    styles.bubble,
                    isUser ? styles.bubbleUser : styles.bubbleAI,
                    message.isError && styles.bubbleError,
                ]}>
                    <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
                        {message.content}
                    </Text>
                </View>
                <Text style={[styles.timeText, isUser ? styles.timeTextUser : styles.timeTextAI]}>
                    {timeStr}
                </Text>
            </View>
        </View>
    );
};

// ─────────────────────────────────────────────────────────────
// 서브 컴포넌트: AI 타이핑 인디케이터
// ─────────────────────────────────────────────────────────────

const TypingIndicator = () => (
    <View style={[styles.bubbleRow, styles.bubbleRowAI]}>
        <View style={styles.avatarContainer}>
            <Text style={styles.avatarEmoji}>🖋️</Text>
        </View>
        <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
            <View style={styles.typingDots}>
                <ActivityIndicator size="small" color={DrawerTheme.goldBright} />
                <Text style={styles.typingText}>  상담사가 신중하게 답변을 작성 중입니다...</Text>
            </View>
        </View>
    </View>
);

// ─────────────────────────────────────────────────────────────
// 메인 화면
// ─────────────────────────────────────────────────────────────

const AIChatScreen = ({ navigation, route }) => {
    const insets = useSafeAreaInsets();
    const scrollRef = useRef(null);
    const { customer } = useAuth();
    const [inputText, setInputText] = useState('');

    const isGuest = customer?.isGuest || customer?.id === 'guest';
    const { messages, loading, initialized, initialize, sendMessage, resetChat, loadSession } = useAIChat();

    // 회원 전용 기능 - 과거 세션 로드 처리
    useEffect(() => {
        if (route.params?.session) {
            loadSession(route.params.session);
            // 파라미터 초기화 (뒤로 가기 시 중복 방지)
            navigation.setParams({ session: null });
        }
    }, [route.params?.session]);

    const isPremium = !isGuest && (customer?.membership_type === 'Pro' || customer?.membership_type === 'Premium');
    const membershipType = customer?.membership_type || 'Free';

    // 남은 횟수 계산 로직
    let usageInfo = '';
    let hasRemaining = true;

    if (customer && !isGuest) {
        if (membershipType === 'Free') {
            const remaining = Math.max(0, 100 - (customer.monthly_ai_count || 0));
            usageInfo = `이번 달 남은 상담: ${remaining}회`;
            hasRemaining = remaining > 0;
        } else if (membershipType === 'Pro') {
            const remaining = Math.max(0, 10 - (customer.daily_ai_count || 0));
            usageInfo = `오늘 남은 상담: ${remaining}회`;
            hasRemaining = remaining > 0;
        } else if (membershipType === 'Premium') {
            const remaining = Math.max(0, 50 - (customer.daily_ai_count || 0));
            usageInfo = `오늘 남은 상담: ${remaining}회`;
            hasRemaining = remaining > 0;
        }
    }

    // 화면 진입 및 초기화 상태 복구
    useEffect(() => {
        if (!isGuest && !route.params?.session && !initialized && !loading) {
            initialize();
        }
    }, [isGuest, initialized, loading]);

    // 새 메시지 올 때마다 스크롤 아래로
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages, loading]);

    const handleSend = async () => {
        const text = inputText.trim();
        if (!text || loading) return;

        if (!hasRemaining) {
            Alert.alert(
                '상담 횟수 소진',
                `${membershipType === 'Free' ? '이번 달' : '오늘'} 무료 상담 횟수가 모두 소진되었습니다. 더 많은 상담을 위해 업그레이드할까요?`,
                [
                    { text: '나중에', style: 'cancel' },
                    { text: '업그레이드', onPress: () => navigation.navigate('Membership') }
                ]
            );
            return;
        }

        setInputText('');
        await sendMessage(text);
    };

    const handleReset = () => {
        Alert.alert(
            '대화 저장 및 초기화',
            '현재 대화 내용을 보관함에 저장하고 새로운 대화를 시작할까요?',
            [
                { text: '취소', style: 'cancel' },
                { text: '저장 및 리셋', style: 'destructive', onPress: () => { resetChat(); } },
            ]
        );
    };

    // 빠른 질문 예시
    const quickQuestions = [
        '오늘의 행운을 불러오는 방법은?',
        '연애운이 언제쯤 좋아질까요?',
        '나에게 맞는 직업 방향은?',
        '마음이 편안해지는 조언을 해주세요',
    ];

    if (isGuest) {
        return (
            <GradientBackground>
                <View style={[styles.guestContainer, { paddingTop: insets.top }]}>
                    <View style={styles.guestCard}>
                        <Text style={styles.guestEmoji}>🔐</Text>
                        <Text style={styles.guestTitle}>회원 전용 기능입니다</Text>
                        <Text style={styles.guestSubtitle}>
                            AI 타로 상담사와 나누는 깊은 대화는{"\n"}
                            회원님들께만 제공되는 특별한 서비스입니다.{"\n\n"}
                            로그인하여 당신만을 위한{"\n"}
                            섬세한 조언을 들어보세요.
                        </Text>

                        <TouchableOpacity
                            style={styles.guestLoginButton}
                            onPress={() => navigation.navigate('Login')}
                        >
                            <Text style={styles.guestLoginButtonText}>로그인 / 회원가입</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                {/* 프리미엄 업그레이드 배너 */}
                {!isPremium && (
                    <TouchableOpacity
                        style={[styles.premiumBanner, { paddingTop: insets.top }]}
                        onPress={() => navigation.navigate('Membership')}
                        activeOpacity={0.9}
                    >
                        <View style={styles.premiumBannerContent}>
                            <Text style={styles.premiumBannerText}>✨ 무제한 AI 상담과 독점 타로 혜택을 누려보세요!</Text>
                            <View style={styles.premiumBadgeMin}>
                                <Text style={styles.premiumBadgeMinText}>UPGRADE</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}

                {/* 헤더 */}
                <View style={[styles.header, isPremium && { paddingTop: insets.top + 10 }]}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity
                            style={styles.historyTrigger}
                            onPress={() => navigation.navigate('AIChatHistory')}
                        >
                            <Text style={styles.historyEmoji}>📋</Text>
                        </TouchableOpacity>
                        <View style={styles.avatarMain}>
                            <Text style={styles.headerEmoji}>🖋️</Text>
                        </View>
                        <View>
                            <View style={styles.headerTitleRow}>
                                <Text style={styles.headerTitle}>AI 타일러 상담소</Text>
                                {isPremium && (
                                    <View style={[styles.proBadge, { backgroundColor: membershipType === 'Premium' ? '#A06AF9' : DrawerTheme.goldBright }]}>
                                        <Text style={styles.proBadgeText}>{membershipType.toUpperCase()}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.usageRow}>
                                <View style={[styles.usageDot, { backgroundColor: hasRemaining ? '#4CAF50' : '#FF5252' }]} />
                                <Text style={styles.headerSubtitle}>
                                    {usageInfo}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
                        <Text style={styles.resetText}>↻ 저장 및 리셋</Text>
                    </TouchableOpacity>
                </View>

                {/* 채팅 영역 */}
                <ScrollView
                    ref={scrollRef}
                    style={styles.chatArea}
                    contentContainerStyle={styles.chatContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* 로딩 중 초기화 상태 */}
                    {!initialized && loading && (
                        <View style={styles.initLoading}>
                            <ActivityIndicator size="large" color={DrawerTheme.goldBright} />
                            <Text style={styles.initLoadingText}>AI 상담사가 고민을 들을 준비를 하고 있습니다...</Text>
                        </View>
                    )}

                    {/* 메시지 목록 */}
                    {messages.map(msg => (
                        <ChatBubble key={msg.id} message={msg} />
                    ))}

                    {/* AI 타이핑 인디케이터 */}
                    {loading && initialized && <TypingIndicator />}

                    {/* 빠른 질문 버튼 (메시지가 1개 이하일 때만) */}
                    {messages.length <= 1 && !loading && initialized && (
                        <View style={styles.quickQuestions}>
                            <Text style={styles.quickTitle}>💬 AI 타일러에게 물어보세요</Text>
                            <View style={styles.quickGrid}>
                                {quickQuestions.map((q, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={styles.quickBtn}
                                        onPress={() => sendMessage(q)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.quickBtnText}>{q}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* 입력창 */}
                <View style={[styles.inputArea, { paddingBottom: insets.bottom + 10 }]}>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.textInput}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="이곳에 고민을 적어주세요..."
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            multiline
                            maxLength={1000}
                            returnKeyType="default"
                            editable={!loading}
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
                            onPress={handleSend}
                            disabled={!inputText.trim() || loading}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.sendIcon}>✦</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </GradientBackground>
    );
};

// ─────────────────────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    // 프리미엄 배너
    premiumBanner: {
        backgroundColor: '#7209B7',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.2)',
    },
    premiumBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 8,
    },
    premiumBannerText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    premiumBadgeMin: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    premiumBadgeMinText: {
        color: '#000',
        fontSize: 10,
        fontWeight: '900',
    },

    // 헤더
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatarMain: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: DrawerTheme.goldBright,
    },
    headerEmoji: { fontSize: 24 },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#FFF',
        letterSpacing: -0.5,
    },
    proBadge: {
        backgroundColor: DrawerTheme.goldBright,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    proBadgeText: {
        color: '#000',
        fontSize: 10,
        fontWeight: '900',
    },
    usageRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    usageDot: { width: 6, height: 6, borderRadius: 3 },
    headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
    historyTrigger: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 4,
    },
    historyEmoji: { fontSize: 18 },
    resetButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    resetText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },

    // 채팅 영역
    chatArea: { flex: 1 },
    chatContent: { paddingHorizontal: 16, paddingVertical: 24, gap: 16 },

    // 말풍선
    bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 },
    bubbleRowUser: { justifyContent: 'flex-end' },
    bubbleRowAI: { justifyContent: 'flex-start' },
    avatarContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    avatarEmoji: { fontSize: 16 },
    bubbleWrapper: { maxWidth: '80%' },
    bubble: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 22,
    },
    bubbleUser: {
        backgroundColor: '#7209B7',
        borderBottomRightRadius: 2,
    },
    bubbleAI: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderBottomLeftRadius: 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    bubbleError: {
        borderColor: 'rgba(255,100,100,0.4)',
        backgroundColor: 'rgba(255,50,50,0.1)',
    },
    bubbleText: { fontSize: 15, lineHeight: 22, color: '#FFF' },
    bubbleTextUser: { fontWeight: '500' },
    bubbleTextAI: { color: 'rgba(255,255,255,0.95)' },
    timeText: { fontSize: 10, marginTop: 4, color: 'rgba(255,255,255,0.3)', fontWeight: '400' },
    timeTextUser: { textAlign: 'right', marginRight: 4 },
    timeTextAI: { textAlign: 'left', marginLeft: 4 },

    // 타이핑 인디케이터
    typingBubble: { paddingVertical: 14, paddingHorizontal: 16 },
    typingDots: { flexDirection: 'row', alignItems: 'center' },
    typingText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginLeft: 8 },

    // 초기 로딩
    initLoading: { flex: 1, alignItems: 'center', paddingTop: 100, gap: 20 },
    initLoadingText: { color: DrawerTheme.goldBright, fontSize: 14, textAlign: 'center', opacity: 0.8 },

    // 빠른 질문
    quickQuestions: {
        marginTop: 10,
        gap: 12,
        paddingHorizontal: 10,
    },
    quickTitle: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    quickGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
    },
    quickBtn: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    quickBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500' },

    // 입력창
    inputArea: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'rgba(15,0,30,0.8)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
    },
    textInput: {
        flex: 1,
        minHeight: 46,
        maxHeight: 150,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 24,
        paddingHorizontal: 18,
        paddingVertical: 12,
        color: '#FFF',
        fontSize: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    sendButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: DrawerTheme.goldBright,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: DrawerTheme.goldBright,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    sendButtonDisabled: { backgroundColor: 'rgba(255,255,255,0.1)', elevation: 0, shadowOpacity: 0 },
    sendIcon: { color: '#000', fontSize: 22, fontWeight: 'bold' },

    // 게스트 모드 스타일
    guestContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    guestCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 24,
        padding: 40,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    guestEmoji: {
        fontSize: 50,
        marginBottom: 20,
    },
    guestTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: DrawerTheme.goldBright,
        marginBottom: 15,
    },
    guestSubtitle: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 30,
    },
    guestLoginButton: {
        backgroundColor: DrawerTheme.goldBright,
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 14,
        width: '100%',
        alignItems: 'center',
    },
    guestLoginButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '800',
    },
});

export default AIChatScreen;