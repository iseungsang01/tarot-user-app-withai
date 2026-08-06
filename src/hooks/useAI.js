import { useState, useCallback, useRef, useEffect } from 'react';
import {    analyzeVisitHistory,
    polishReviewText,
    condenseVoiceMemo,
} from '../services/aiService';
import {
    canUseDrawerAI,
    incrementDrawerAIUsage,
    getRemainingDrawerAIUsage,
} from '../utils/storage/drawerAIUsage';

const isAbortError = (error) => error?.name === 'AbortError' || /aborted/i.test(error?.message || '');

/**
 * 월 사용량 한도가 걸린 AI 액션 훅을 만든다.
 * 세 AI 기능(전체 요약 · 메모 축약 · 문장 다듬기)이 공유하는
 * 상태 관리 · 중복요청 취소 · 사용량 회계를 한 곳에 모은다.
 *
 * @param {object}   spec
 * @param {string}   spec.featureKey   - drawerAIUsage 한도 키
 * @param {string}   spec.actionName   - 반환 객체에 노출할 실행 함수 이름
 * @param {function} spec.call         - (input, signal) => { data, error }
 * @param {*}        spec.emptyResult  - result 초기값
 * @param {string}   spec.limitMessage - 한도 소진 시 문구
 * @param {string}   spec.failMessage  - 실패 시 기본 문구
 * @param {boolean} [spec.clearResultOnStart] - 실행 시작 시 이전 결과를 지울지
 * @param {boolean} [spec.skipWhileLoading]   - 실행 중 재호출을 무시할지
 * @param {function} [spec.validateInput]     - (input) => 에러 메시지 | null
 * @param {function} [spec.validateOutput]    - (data) => 에러 메시지 | null
 * @param {function} [spec.mapResult]         - (data) => result
 */
const createDrawerAIAction = ({
    featureKey,
    actionName,
    call,
    emptyResult,
    limitMessage,
    failMessage,
    clearResultOnStart = true,
    skipWhileLoading = false,
    validateInput,
    validateOutput,
    mapResult = (data) => data,
}) => () => {
    const [result, setResult] = useState(emptyResult);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [remaining, setRemaining] = useState(null);
    const abortControllerRef = useRef(null);

    const refreshRemaining = useCallback(async () => {
        const next = await getRemainingDrawerAIUsage(featureKey);
        setRemaining(next);
        return next;
    }, []);

    const run = useCallback(async (input) => {
        if (skipWhileLoading && loading) return { data: null, error: null };

        const inputError = validateInput?.(input);
        if (inputError) return { data: null, error: new Error(inputError) };

        // 진행 중인 이전 요청은 취소하고 마지막 호출만 반영한다
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        setError(null);
        if (clearResultOnStart) setResult(emptyResult);

        try {
            if (!await canUseDrawerAI(featureKey)) {
                const limitError = new Error(limitMessage);
                setError(limitError.message);
                await refreshRemaining();
                return { data: null, error: limitError };
            }

            const { data, error: apiError } = await call(input, controller.signal);
            if (abortControllerRef.current !== controller) return { data: null, error: null };

            if (apiError) {
                if (!isAbortError(apiError)) setError(apiError.message || failMessage);
                return { data: null, error: apiError };
            }

            const outputError = validateOutput?.(data);
            if (outputError) {
                setError(outputError);
                return { data: null, error: new Error(outputError) };
            }

            // increment가 갱신된 잔여 횟수를 함께 돌려주므로 재조회하지 않는다
            const { remaining: nextRemaining } = await incrementDrawerAIUsage(featureKey);
            setRemaining(nextRemaining);

            const mapped = mapResult(data);
            setResult(mapped);
            return { data: mapped, error: null };
        } catch (err) {
            if (abortControllerRef.current === controller && !isAbortError(err)) {
                setError(err.message || failMessage);
            }
            return { data: null, error: err };
        } finally {
            if (abortControllerRef.current === controller) setLoading(false);
        }
    }, [loading, refreshRemaining]);

    const reset = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setResult(emptyResult);
        setError(null);
        setLoading(false);
    }, []);

    useEffect(() => {
        refreshRemaining();
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [refreshRemaining]);

    return { result, loading, error, remaining, refreshRemaining, [actionName]: run, reset };
};

/** 상담 기록 전체를 종합 분석한다. */
export const useAnalyzeHistory = createDrawerAIAction({
    featureKey: 'historySummary',
    actionName: 'analyze',
    call: (visits, signal) => analyzeVisitHistory(visits, signal),
    emptyResult: null,
    limitMessage: '이번 달 전체 요약 사용 횟수를 모두 사용했습니다.',
    failMessage: 'AI 분석 중 오류가 발생했습니다.',
});

/** 서랍 음성 메모를 짧은 문구로 축약한다. */
export const useCondenseVoiceMemo = createDrawerAIAction({
    featureKey: 'voiceCondense',
    actionName: 'condense',
    call: (transcriptText, signal) => condenseVoiceMemo(transcriptText, signal),
    emptyResult: '',
    limitMessage: '이번 달 메모 축약 사용 횟수를 모두 사용했습니다.',
    failMessage: '메모 축약 중 오류가 발생했습니다.',
    skipWhileLoading: true,
    validateInput: (text) => (text?.trim() ? null : '축약할 메모가 없습니다.'),
    validateOutput: (data) => (data ? null : '축약 결과를 만들 수 없습니다. 메모를 조금 다듬은 뒤 다시 시도해 주세요.'),
});

/** 상담 기록 문장을 다듬는다. 이전 결과는 새 결과가 나올 때까지 유지한다. */
export const usePolishReview = createDrawerAIAction({
    featureKey: 'polishReview',
    actionName: 'polish',
    call: (reviewText, signal) => polishReviewText(reviewText, signal),
    emptyResult: '',
    limitMessage: '이번 달 AI 문장 다듬기 사용 횟수를 모두 사용했습니다.',
    failMessage: 'AI 문장 다듬기 중 오류가 발생했습니다.',
    clearResultOnStart: false,
    skipWhileLoading: true,
    validateInput: (text) => (text?.trim() ? null : '다듬을 메모가 없습니다.'),
    mapResult: (data) => data || '',
});
