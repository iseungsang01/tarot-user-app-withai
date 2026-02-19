/**
 * src/hooks/useOpenAI.js
 * OpenAI 기능 관련 커스텀 훅
 */

import { useState, useCallback, useRef } from 'react';
import {
  summarizeReview,
  analyzeVisitHistory,
  sendChatMessage,
  getWelcomeMessage,
} from '../services/openaiService';

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
  const [messages, setMessages] = useState([]); // { id, role, content, timestamp }
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const conversationRef = useRef([]); // OpenAI API용 히스토리 (role + content만)

  /**
   * 채팅 초기화 및 환영 메시지 로드
   */
  const initialize = useCallback(async () => {
    if (initialized) return;

    setLoading(true);

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
    }

    setInitialized(true);
    setLoading(false);
  }, [initialized]);

  /**
   * 메시지 전송
   * @param {string} userText - 사용자 입력 텍스트
   */
  const sendMessage = useCallback(async (userText) => {
    if (!userText?.trim() || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: userText.trim(),
      timestamp: new Date(),
    };

    // UI에 즉시 사용자 메시지 추가
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // API 호출용 히스토리에 추가
    const updatedHistory = [...conversationRef.current, { role: 'user', content: userText.trim() }];

    const { data, error } = await sendChatMessage(
      conversationRef.current,
      userText.trim()
    );

    if (error) {
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '죄송합니다, 잠시 연결이 원활하지 않습니다. 다시 시도해주세요. 🙏',
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMsg]);
    } else {
      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // 히스토리 업데이트 (최대 20턴 유지 - 토큰 절약)
      conversationRef.current = [
        ...updatedHistory,
        { role: 'assistant', content: data },
      ].slice(-20);
    }

    setLoading(false);
  }, [loading]);

  /**
   * 대화 초기화
   */
  const resetChat = useCallback(() => {
    setMessages([]);
    conversationRef.current = [];
    setInitialized(false);
  }, []);

  return {
    messages,
    loading,
    initialized,
    initialize,
    sendMessage,
    resetChat,
  };
};