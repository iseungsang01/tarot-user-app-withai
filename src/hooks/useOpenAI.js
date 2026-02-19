import { useState, useCallback, useRef } from 'react';
import {
    summarizeReview,
    analyzeVisitHistory,
    sendChatMessage,
    getWelcomeMessage,
    incrementAIUsage,
} from '../services/openaiService';
import { useAuth } from './useAuth';
import { storage } from '../utils/storage';

// ─────────────────────────────────────────────────────────────
// 1. 상담 기록 분석 훅
// ─────────────────────────────────────────────────────────────

/**
 * 단일 상담 기록 요약 훅
 */
export const useSummarizeReview = () => {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const summarize = useCallback(async (reviewText, visitDate) => {
        if (!reviewText?.trim()) return;

        setLoading(true);
        setError(null);
        setResult(null);

        const { data, error: apiError } = await summarizeReview(reviewText, visitDate);

        if (apiError) {
            setError(apiError.message || 'AI 분석 중 오류가 발생했습니다.');
        } else {
            setResult(data);
        }

        setLoading(false);
    }, []);

    const reset = useCallback(() => {
        setResult(null);
        setError(null);
    }, []);

    return { result, loading, error, summarize, reset };
};

/**
 * 전체 방문 기록 종합 분석 훅
 */
export const useAnalyzeHistory = () => {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const analyze = useCallback(async (visits) => {
        setLoading(true);
        setError(null);
        setResult(null);

        const { data, error: apiError } = await analyzeVisitHistory(visits);

        if (apiError) {
            setError(apiError.message || 'AI 분석 중 오류가 발생했습니다.');
        } else {
            setResult(data);
        }

        setLoading(false);
    }, []);

    const reset = useCallback(() => {
        setResult(null);
        setError(null);
    }, []);

    return { result, loading, error, analyze, reset };
};

// ─────────────────────────────────────────────────────────────
// 2. AI 챗봇 훅
// ─────────────────────────────────────────────────────────────

/**
 * AI 챗봇 훅
 * 대화 히스토리 관리 및 메시지 전송
 */
export const useAIChat = () => {
    const { customer, refreshCustomer } = useAuth();
    const [messages, setMessages] = useState([]); // { id, role, content, timestamp }
    const [loading, setLoading] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const conversationRef = useRef([]); // OpenAI API용 히스토리 (role + content만)

    /**
     * 채팅 초기화 및 환영 메시지 로드
     */
    const initialize = useCallback(async () => {
        if (initialized || !customer?.id) return;

        setLoading(true);

        // 1. 로컬 저장소에서 기존 대화 내역 시도
        const localHistory = await storage.getAIChatHistory(customer.id);

        if (localHistory && localHistory.length > 0) {
            setMessages(localHistory);
            // API용 히스토리는 최근 20개만 유지
            conversationRef.current = localHistory
                .slice(-20)
                .map(msg => ({ role: msg.role, content: msg.content }));
        } else {
            // 2. 내역 없으면 환영 메시지 가져오기
            const { data, error } = await getWelcomeMessage();

            if (!error && data) {
                const welcomeMsg = {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: data,
                    timestamp: new Date(),
                };
                setMessages([welcomeMsg]);
                conversationRef.current = [{ role: 'assistant', content: data }];

                // 환영 메시지 즉시 저장
                await storage.saveAIChatHistory(customer.id, [welcomeMsg]);
            }
        }

        setInitialized(true);
        setLoading(false);
    }, [initialized, customer?.id]);

    /**
     * 메시지 전송
     * @param {string} userText - 사용자 입력 텍스트
     */
    const sendMessage = useCallback(async (userText) => {
        if (!userText?.trim() || loading || !customer?.id) return;

        const userMsg = {
            id: Date.now().toString(),
            role: 'user',
            content: userText.trim(),
            timestamp: new Date(),
        };

        // UI에 즉시 사용자 메시지 추가
        const updatedMessagesWithUser = [...messages, userMsg];
        setMessages(updatedMessagesWithUser);
        setLoading(true);

        // 로컬 저장 (사용자 메시지 보낸 시점)
        await storage.saveAIChatHistory(customer.id, updatedMessagesWithUser);

        // API 사용량 체크 및 차감
        if (customer && !customer.isGuest) {
            const usageResult = await incrementAIUsage(customer.id);
            if (!usageResult.success) {
                const limitMsg = {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: usageResult.message || '상담 횟수가 초과되었습니다.',
                    timestamp: new Date(),
                    isError: true,
                };
                const finalMessagesWithLimit = [...updatedMessagesWithUser, limitMsg];
                setMessages(finalMessagesWithLimit);
                await storage.saveAIChatHistory(customer.id, finalMessagesWithLimit);
                setLoading(false);
                return;
            }
            refreshCustomer();
        }

        // API 호출용 히스토리에 추가 (기존 히스토리 + 새 메시지)
        const updatedHistory = [...conversationRef.current, { role: 'user', content: userText.trim() }];

        const { data, error } = await sendChatMessage(
            conversationRef.current,
            userText.trim()
        );

        if (error) {
            const errorMsg = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data || error.message || '상담 중 오류가 발생했습니다.',
                timestamp: new Date(),
                isError: true,
            };
            const finalMessagesWithError = [...updatedMessagesWithUser, errorMsg];
            setMessages(finalMessagesWithError);
            await storage.saveAIChatHistory(customer.id, finalMessagesWithError);
        } else {
            const assistantMsg = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data,
                timestamp: new Date(),
            };
            const finalMessagesWithAI = [...updatedMessagesWithUser, assistantMsg];
            setMessages(finalMessagesWithAI);

            // AI 답변까지 포함하여 로컬 저장
            await storage.saveAIChatHistory(customer.id, finalMessagesWithAI);

            // context 히스토리 업데이트 (최대 20턴 유지 - 토큰 절약)
            conversationRef.current = [
                ...updatedHistory,
                { role: 'assistant', content: data },
            ].slice(-20);
        }

        setLoading(false);
    }, [loading, customer, messages, refreshCustomer]);

    /**
     * 특정 과거 세션 로드
     */
    const loadSession = useCallback((session) => {
        if (!session || !session.messages) return;
        setMessages(session.messages);
        conversationRef.current = session.messages
            .slice(-20)
            .map(msg => ({ role: msg.role, content: msg.content }));
        setInitialized(true);
    }, []);

    /**
     * 대화 초기화
     * 초기화 전 현재 대화를 보관함에 저장(아카이빙)
     */
    const resetChat = useCallback(async () => {
        // 1. 현재 대화가 있으면 아카이빙 (비동기)
        if (customer?.id && messages.length > 1) {
            try {
                await storage.archiveAIChatSession(customer.id, messages);
            } catch (e) {
                console.error('Session archiving failed:', e);
            }
        }

        // 2. 현재 활성 대화 내역 삭제 (비동기)
        if (customer?.id) {
            try {
                await storage.deleteAIChatHistory(customer.id);
            } catch (e) {
                console.error('History deletion failed:', e);
            }
        }

        // 3. 상태 초기화 (이 작업이 완료되면 useEffect 등에 의해 initialize가 트리거됨)
        setMessages([]);
        conversationRef.current = [];
        setInitialized(false);
    }, [customer?.id, messages]);

    return {
        messages,
        loading,
        initialized,
        initialize,
        sendMessage,
        resetChat,
        loadSession,
    };
};
