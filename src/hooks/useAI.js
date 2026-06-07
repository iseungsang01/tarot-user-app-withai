import { useState, useCallback, useRef, useEffect } from 'react';
import {
    summarizeReview,
    analyzeVisitHistory,
    polishReviewText,
    condenseVoiceMemo,
} from '../services/aiService';
import {
    incrementDrawerAIUsage,
    getRemainingDrawerAIUsage,
} from '../utils/storage/drawerAIUsage';

const getQuotaRemaining = (quota) => (
    quota && Number.isFinite(Number(quota.remaining)) ? Number(quota.remaining) : null
);

const applyQuotaFallbackCache = async (featureKey, quota) => {
    if (quota) return getQuotaRemaining(quota);
    const result = await incrementDrawerAIUsage(featureKey);
    return result.remaining;
};

export const useSummarizeReview = () => {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(null);

    const summarize = useCallback(async (reviewText, visitDate) => {
        if (!reviewText?.trim()) return;
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setLoading(true); setError(null); setResult(null);
        try {
            const { data, error: apiError } = await summarizeReview(reviewText, visitDate, controller.signal);
            if (abortControllerRef.current !== controller) return;
            if (apiError) {
                if (apiError.name !== 'AbortError') setError(apiError.message || 'AI 분석 중 오류가 발생했습니다.');
            } else setResult(data);
        } catch (err) {
            if (abortControllerRef.current === controller && err.name !== 'AbortError') setError(err.message || 'AI 분석 중 오류가 발생했습니다.');
        } finally {
            if (abortControllerRef.current === controller) setLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setResult(null); setError(null); setLoading(false);
    }, []);

    useEffect(() => () => abortControllerRef.current?.abort(), []);
    return { result, loading, error, summarize, reset };
};

export const useAnalyzeHistory = () => {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [remaining, setRemaining] = useState(null);
    const abortControllerRef = useRef(null);

    const refreshRemaining = useCallback(async () => {
        const next = await getRemainingDrawerAIUsage('historySummary');
        setRemaining(next);
        return next;
    }, []);

    const analyze = useCallback(async (visits) => {
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setLoading(true); setError(null); setResult(null);
        try {
            const { data, error: apiError, quota } = await analyzeVisitHistory(visits, controller.signal);
            if (abortControllerRef.current !== controller) return;
            if (apiError) {
                if (apiError.name !== 'AbortError') {
                    setError(apiError.message || 'AI 분석 사용량 확인 또는 요청 중 오류가 발생했습니다.');
                    const quotaRemaining = getQuotaRemaining(apiError.quota);
                    if (quotaRemaining !== null) setRemaining(quotaRemaining);
                }
            } else {
                const nextRemaining = await applyQuotaFallbackCache('historySummary', quota);
                if (nextRemaining !== null) setRemaining(nextRemaining);
                setResult(data);
            }
        } catch (err) {
            if (abortControllerRef.current === controller && err.name !== 'AbortError') setError(err.message || 'AI 분석 사용량 확인 또는 요청 중 오류가 발생했습니다.');
        } finally {
            if (abortControllerRef.current === controller) setLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setResult(null); setError(null); setLoading(false);
    }, []);

    useEffect(() => { refreshRemaining(); return () => abortControllerRef.current?.abort(); }, [refreshRemaining]);
    return { result, loading, error, remaining, refreshRemaining, analyze, reset };
};

export const useCondenseVoiceMemo = () => {
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [remaining, setRemaining] = useState(null);
    const abortControllerRef = useRef(null);

    const refreshRemaining = useCallback(async () => {
        const next = await getRemainingDrawerAIUsage('voiceCondense');
        setRemaining(next);
        return next;
    }, []);

    const condense = useCallback(async (transcriptText) => {
        if (!transcriptText?.trim()) return { data: null, error: new Error('축약할 음성 기록이 없습니다.') };
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setLoading(true); setError(null); setResult('');
        try {
            const { data, error: apiError, quota } = await condenseVoiceMemo(transcriptText, controller.signal);
            if (abortControllerRef.current !== controller) return { data: null, error: null };
            if (apiError) {
                if (apiError.name !== 'AbortError') {
                    setError(apiError.message || '녹음 내용 축약 사용량 확인 또는 요청 중 오류가 발생했습니다.');
                    const quotaRemaining = getQuotaRemaining(apiError.quota);
                    if (quotaRemaining !== null) setRemaining(quotaRemaining);
                }
                return { data: null, error: apiError };
            }
            const nextRemaining = await applyQuotaFallbackCache('voiceCondense', quota);
            if (nextRemaining !== null) setRemaining(nextRemaining);
            setResult(data || '');
            return { data: data || '', error: null };
        } catch (err) {
            if (abortControllerRef.current === controller && err.name !== 'AbortError') setError(err.message || '녹음 내용 축약 사용량 확인 또는 요청 중 오류가 발생했습니다.');
            return { data: null, error: err };
        } finally {
            if (abortControllerRef.current === controller) setLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setResult(''); setError(null); setLoading(false);
    }, []);

    useEffect(() => { refreshRemaining(); return () => abortControllerRef.current?.abort(); }, [refreshRemaining]);
    return { result, loading, error, remaining, refreshRemaining, condense, reset };
};

export const usePolishReview = () => {
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(null);

    const polish = useCallback(async (reviewText) => {
        if (!reviewText?.trim()) return;
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setLoading(true); setError(null);
        try {
            const { data, error: apiError } = await polishReviewText(reviewText, controller.signal);
            if (abortControllerRef.current !== controller) return;
            if (apiError) {
                if (apiError.name !== 'AbortError') setError(apiError.message || '문장 다듬기 중 오류가 발생했습니다.');
            } else setResult(data || '');
        } catch (err) {
            if (abortControllerRef.current === controller && err.name !== 'AbortError') setError(err.message || '문장 다듬기 중 오류가 발생했습니다.');
        } finally {
            if (abortControllerRef.current === controller) setLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setResult(''); setError(null); setLoading(false);
    }, []);

    useEffect(() => () => abortControllerRef.current?.abort(), []);
    return { result, loading, error, polish, reset };
};
