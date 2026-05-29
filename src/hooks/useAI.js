import { useState, useCallback, useRef, useEffect } from 'react';
import {
    summarizeReview,
    analyzeVisitHistory,
    polishReviewText,
} from '../services/aiService';

// ─────────────────────────────────────────────────────────────
// 1. Consultation Review Analysis Hooks
// ─────────────────────────────────────────────────────────────

/**
 * Hook for summarizing a single review text
 */
export const useSummarizeReview = () => {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(null);

    const summarize = useCallback(async (reviewText, visitDate) => {
        if (!reviewText?.trim()) return;

        // Cancel previous request if any is pending
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const { data, error: apiError } = await summarizeReview(reviewText, visitDate, controller.signal);

            // Verify if this request is still the latest one
            if (abortControllerRef.current === controller) {
                if (apiError) {
                    if (apiError.name !== 'AbortError') {
                        setError(apiError.message || 'AI 분석 중 오류가 발생했습니다.');
                    }
                } else {
                    setResult(data);
                }
            }
        } catch (err) {
            if (abortControllerRef.current === controller && err.name !== 'AbortError') {
                setError(err.message || 'AI 분석 중 오류가 발생했습니다.');
            }
        } finally {
            if (abortControllerRef.current === controller) {
                setLoading(false);
            }
        }
    }, []);

    const reset = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setResult(null);
        setError(null);
        setLoading(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return { result, loading, error, summarize, reset };
};

/**
 * Hook for comprehensive history analysis
 */
export const useAnalyzeHistory = () => {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(null);

    const analyze = useCallback(async (visits) => {
        // Cancel previous request if any is pending
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const { data, error: apiError } = await analyzeVisitHistory(visits, controller.signal);

            if (abortControllerRef.current === controller) {
                if (apiError) {
                    if (apiError.name !== 'AbortError') {
                        setError(apiError.message || 'AI 분석 중 오류가 발생했습니다.');
                    }
                } else {
                    setResult(data);
                }
            }
        } catch (err) {
            if (abortControllerRef.current === controller && err.name !== 'AbortError') {
                setError(err.message || 'AI 분석 중 오류가 발생했습니다.');
            }
        } finally {
            if (abortControllerRef.current === controller) {
                setLoading(false);
            }
        }
    }, []);

    const reset = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setResult(null);
        setError(null);
        setLoading(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return { result, loading, error, analyze, reset };
};

/**
 * Hook for polishing review text
 */
export const usePolishReview = () => {
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(null);

    const polish = useCallback(async (reviewText) => {
        if (!reviewText?.trim()) return;

        // Cancel previous request if any is pending
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const { data, error: apiError } = await polishReviewText(reviewText, controller.signal);

            if (abortControllerRef.current === controller) {
                if (apiError) {
                    if (apiError.name !== 'AbortError') {
                        setError(apiError.message || 'AI 다듬기 중 오류가 발생했습니다.');
                    }
                } else {
                    setResult(data || '');
                }
            }
        } catch (err) {
            if (abortControllerRef.current === controller && err.name !== 'AbortError') {
                setError(err.message || 'AI 다듬기 중 오류가 발생했습니다.');
            }
        } finally {
            if (abortControllerRef.current === controller) {
                setLoading(false);
            }
        }
    }, []);

    const reset = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setResult('');
        setError(null);
        setLoading(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return { result, loading, error, polish, reset };
};
