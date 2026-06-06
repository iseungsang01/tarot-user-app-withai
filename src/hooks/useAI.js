import { useState, useCallback, useRef, useEffect } from 'react';
import {
    summarizeReview,
    analyzeVisitHistory,
    polishReviewText,
    condenseVoiceMemo,
} from '../services/aiService';
import {
    canUseDrawerAI,
    incrementDrawerAIUsage,
    getRemainingDrawerAIUsage,
} from '../utils/storage/drawerAIUsage';

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
    const [remaining, setRemaining] = useState(null);
    const abortControllerRef = useRef(null);

    const refreshRemaining = useCallback(async () => {
        const next = await getRemainingDrawerAIUsage('historySummary');
        setRemaining(next);
        return next;
    }, []);

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
            const canUse = await canUseDrawerAI('historySummary');
            if (!canUse) {
                setError('\uC774\uBC88 \uB2EC \uC804\uCCB4 \uC694\uC57D \uC0AC\uC6A9 \uD69F\uC218\uB97C \uBAA8\uB450 \uC0AC\uC6A9\uD588\uC2B5\uB2C8\uB2E4.');
                await refreshRemaining();
                return;
            }

            const { data, error: apiError } = await analyzeVisitHistory(visits, controller.signal);

            if (abortControllerRef.current === controller) {
                if (apiError) {
                    if (apiError.name !== 'AbortError') {
                        setError(apiError.message || 'AI 분석 중 오류가 발생했습니다.');
                    }
                } else {
                    await incrementDrawerAIUsage('historySummary');
                    await refreshRemaining();
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
    }, [refreshRemaining]);

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
        refreshRemaining();
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [refreshRemaining]);

    return { result, loading, error, remaining, refreshRemaining, analyze, reset };
};


/**
 * Hook for drawer voice memo condensation with monthly usage accounting.
 */
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
        if (!transcriptText?.trim()) return { data: null, error: new Error('\uCD95\uC57D\uD560 \uC74C\uC131 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.') };

        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        setError(null);
        setResult('');

        try {
            const canUse = await canUseDrawerAI('voiceCondense');
            if (!canUse) {
                const limitError = new Error('\uC774\uBC88 \uB2EC \uB179\uC74C \uCD95\uC57D \uC0AC\uC6A9 \uD69F\uC218\uB97C \uBAA8\uB450 \uC0AC\uC6A9\uD588\uC2B5\uB2C8\uB2E4.');
                setError(limitError.message);
                await refreshRemaining();
                return { data: null, error: limitError };
            }

            const { data, error: apiError } = await condenseVoiceMemo(transcriptText, controller.signal);
            if (abortControllerRef.current !== controller) return { data: null, error: null };

            if (apiError) {
                if (apiError.name !== 'AbortError') setError(apiError.message || '\uB179\uC74C \uB0B4\uC6A9 \uCD95\uC57D \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.');
                return { data: null, error: apiError };
            }

            await incrementDrawerAIUsage('voiceCondense');
            await refreshRemaining();
            setResult(data || '');
            return { data: data || '', error: null };
        } catch (err) {
            if (abortControllerRef.current === controller && err.name !== 'AbortError') {
                setError(err.message || '\uB179\uC74C \uB0B4\uC6A9 \uCD95\uC57D \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.');
            }
            return { data: null, error: err };
        } finally {
            if (abortControllerRef.current === controller) setLoading(false);
        }
    }, [refreshRemaining]);

    const reset = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setResult('');
        setError(null);
        setLoading(false);
    }, []);

    useEffect(() => {
        refreshRemaining();
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [refreshRemaining]);

    return { result, loading, error, remaining, refreshRemaining, condense, reset };
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
                if (apiError.name !== 'AbortError') setError(apiError.message || '\uB179\uC74C \uB0B4\uC6A9 \uCD95\uC57D \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.');
                    }
                } else {
                    setResult(data || '');
                }
            }
        } catch (err) {
            if (abortControllerRef.current === controller && err.name !== 'AbortError') {
                setError(err.message || '\uB179\uC74C \uB0B4\uC6A9 \uCD95\uC57D \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.');
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
