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
import { DrawerTheme } from '../constants/DrawerTheme';

// ─────────────────────────────────────────────────────────────
// 서브 컴포넌트: 채팅 말풍선
// ─────────────────────────────────────────────────────────────

const ChatBubble = ({ message }) => {
    const isUser = message.role === 'user';
    const timeStr = message.timestamp
        ? `${message.timestamp.getHours().toString().padStart(2, '0')}:${message.timestamp.getMinutes().toString().padStart(2, '0')}`
        : '';

    return (
        <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
            {!isUser && (
                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarEmoji}>🔮</Text>
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
            <Text style={styles.avatarEmoji}>🔮</Text>
        </View>
        <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
            <View style={styles.typingDots}>
                <ActivityIndicator size="small" color={DrawerTheme.goldBright} />
                <Text style={styles.typingText}>  상담사가 답하는 중...</Text>
            </View>
        </View>
    </View>
);

// ─────────────────────────────────────────────────────────────
// 메인 화면
// ─────────────────────────────────────────────────────────────

const AIChatScreen = () => {
    const insets = useSafeAreaInsets();
    const scrollRef = useRef(null);
    const [inputText, setInputText] = useState('');
    const { messages, loading, initialized, initialize, sendMessage, resetChat } = useAIChat();

    // 화면 진입 시 초기화
    useEffect(() => {
        initialize();
    }, []);

    // 새 메시지 올 때마다 스크롤 아래로
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages, loading]);

    const handleSend = async () => {
        const text = inputText.trim();
        if (!text || loading) return;
        setInputText('');
        await sendMessage(text);
    };

    const handleReset = () => {
        Alert.alert(
            '대화 초기화',
            '대화 내용을 모두 지우고 새로 시작할까요?',
            [
                { text: '취소', style: 'cancel' },
                { text: '초기화', style: 'destructive', onPress: () => { resetChat(); setTimeout(initialize, 100); } },
            ]
        );
    };

    // 빠른 질문 예시
    const quickQuestions = [
        '오늘 하루 운세가 궁금해요',
        '인간관계가 고민이에요',
        '중요한 결정을 앞두고 있어요',
        '요즘 자꾸 불안해요',
    ];

    return (
        <GradientBackground>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                {/* 헤더 */}
                <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerEmoji}>🔮</Text>
                        <View>
                            <Text style={styles.headerTitle}>AI 타로 상담</Text>
                            <Text style={styles.headerSubtitle}>당신의 이야기를 들려주세요</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
                        <Text style={styles.resetText}>↺ 초기화</Text>
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
                            <Text style={styles.initLoadingText}>상담사를 불러오는 중...</Text>
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
                            <Text style={styles.quickTitle}>💬 이런 고민은 어떠세요?</Text>
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
                    )}
                </ScrollView>

                {/* 입력창 */}
                <View style={[styles.inputArea, { paddingBottom: insets.bottom + 10 }]}>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.textInput}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="고민을 자유롭게 이야기해보세요..."
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            multiline
                            maxLength={500}
                            returnKeyType="default"
                            editable={!loading}
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
                            onPress={handleSend}
                            disabled={!inputText.trim() || loading}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.sendIcon}>➤</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.disclaimer}>
                        * AI 응답은 심리적 참고용이며, 전문적 상담을 대체하지 않습니다.
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </GradientBackground>
    );
};

// ─────────────────────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    // 헤더
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerEmoji: { fontSize: 32 },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: DrawerTheme.goldBright,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
    resetButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    resetText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

    // 채팅 영역
    chatArea: { flex: 1 },
    chatContent: { paddingHorizontal: 16, paddingVertical: 20, gap: 12 },

    // 말풍선
    bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
    bubbleRowUser: { justifyContent: 'flex-end' },
    bubbleRowAI: { justifyContent: 'flex-start' },
    avatarContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        marginBottom: 18,
    },
    avatarEmoji: { fontSize: 18 },
    bubbleWrapper: { maxWidth: '75%' },
    bubble: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    bubbleUser: {
        backgroundColor: DrawerTheme.woodMid,
        borderBottomRightRadius: 4,
    },
    bubbleAI: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    bubbleError: {
        borderColor: 'rgba(255,100,100,0.3)',
        backgroundColor: 'rgba(255,50,50,0.05)',
    },
    bubbleText: { fontSize: 15, lineHeight: 22 },
    bubbleTextUser: { color: '#FFF' },
    bubbleTextAI: { color: 'rgba(255,255,255,0.9)' },
    timeText: { fontSize: 10, marginTop: 4, color: 'rgba(255,255,255,0.3)' },
    timeTextUser: { textAlign: 'right' },
    timeTextAI: { textAlign: 'left', marginLeft: 4 },

    // 타이핑 인디케이터
    typingBubble: { paddingVertical: 12 },
    typingDots: { flexDirection: 'row', alignItems: 'center' },
    typingText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },

    // 초기 로딩
    initLoading: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 16 },
    initLoadingText: { color: DrawerTheme.goldBright, fontSize: 14 },

    // 빠른 질문
    quickQuestions: {
        marginTop: 8,
        gap: 8,
    },
    quickTitle: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        marginBottom: 4,
        textAlign: 'center',
    },
    quickBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        alignSelf: 'flex-start',
    },
    quickBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },

    // 입력창
    inputArea: {
        paddingHorizontal: 16,
        paddingTop: 10,
        backgroundColor: 'rgba(0,0,0,0.25)',
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
        minHeight: 44,
        maxHeight: 120,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: '#FFF',
        fontSize: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: DrawerTheme.woodMid,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: { opacity: 0.4 },
    sendIcon: { color: DrawerTheme.goldBright, fontSize: 18 },
    disclaimer: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.25)',
        textAlign: 'center',
        marginTop: 6,
    },
});

export default AIChatScreen;