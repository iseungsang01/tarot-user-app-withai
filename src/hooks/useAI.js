import { useState, useCallback, useRef } from 'react';
import {
    summarizeReview,
    analyzeVisitHistory,
    polishReviewText,
    sendChatMessage,
    getWelcomeMessage,
} from '../services/aiService';
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



export const usePolishReview = () => {
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const polish = useCallback(async (reviewText) => {
        if (!reviewText?.trim()) return;

        setLoading(true);
        setError(null);

        const { data, error: apiError } = await polishReviewText(reviewText);

        if (apiError) {
            setError(apiError.message || 'AI 다듬기 중 오류가 발생했습니다.');
        } else {
            setResult(data || '');
        }

        setLoading(false);
    }, []);

    const reset = useCallback(() => {
        setResult('');
        setError(null);
    }, []);

    return { result, loading, error, polish, reset };
};
