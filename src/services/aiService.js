/**
 * src/services/aiService.js
 * AI 서비스 호출 (Supabase Edge Function 프록시 - Google Gemini 기반)
 */

import { ensureAuthenticatedSession, supabase } from './supabase';
import { readFunctionError } from './supabaseClient';

const EDGE_FUNCTION_NAME = 'ai-proxy';

/** 모델 출력에서 코드펜스와 스마트 따옴표를 걷어낸다. */
const stripJSONDecorators = (text) => {
    if (typeof text !== 'string') return '';
    return text
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```/g, '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .trim();
};

const extractFirstJSONObject = (text) => {
    if (text && typeof text === 'object') return text;
    if (typeof text !== 'string') return null;

    const cleaned = stripJSONDecorators(text);
    const start = cleaned.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < cleaned.length; i += 1) {
        const char = cleaned[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (inString && char === '\\') {
            escaped = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (inString) continue;

        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return cleaned.slice(start, i + 1);
            }
        }
    }

    return null;
};

const escapeNewlinesInJSONString = (jsonText) => {
    let result = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < jsonText.length; i += 1) {
        const char = jsonText[i];

        if (escaped) {
            result += char;
            escaped = false;
            continue;
        }

        if (inString && char === '\\') {
            result += char;
            escaped = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            result += char;
            continue;
        }

        if (inString && char === '\n') {
            result += '\\n';
            continue;
        }

        if (inString && char === '\r') {
            result += '\\r';
            continue;
        }

        result += char;
    }

    return result;
};

const repairJSONText = (jsonText) => {
    if (!jsonText) return jsonText;
    return escapeNewlinesInJSONString(
        jsonText
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/,\s*([}\]])/g, '$1'),
    );
};

const parseFirstJSONObject = (text) => {
    if (text && typeof text === 'object') return text;

    const jsonText = extractFirstJSONObject(text);
    if (!jsonText) return null;

    try {
        return JSON.parse(jsonText);
    } catch {
        try {
            return JSON.parse(repairJSONText(jsonText));
        } catch {
            return null;
        }
    }
};

const collapseDegenerateKoreanRepeats = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/([\u3131-\u318E\uAC00-\uD7A3])\1{3,}/g, '$1');
};

const collapseDegenerateWordRepeats = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/\b([\p{L}\p{N}][\p{L}\p{N}'’-]{1,30})(?:\s+\1\b){2,}/giu, '$1');
};

const sanitizeAIText = (text) => collapseDegenerateWordRepeats(collapseDegenerateKoreanRepeats(text));

const CONDENSE_VOICE_MEMO_SAFE_ERROR = '축약 결과를 만들 수 없습니다. 메모를 조금 다듬은 뒤 다시 시도해 주세요.';
const CONDENSE_VOICE_FORBIDDEN_PATTERNS = [
    /Input text/i,
    /System Instructions/i,
    /system instruction/i,
    /JSON/i,
    /condensed/i,
    /parseable/i,
    /```/,
    /[{}]/,
    /\* Input/i,
    /분석/,
    /지침/,
];

const normalizeComparableText = (text) => String(text || '')
    .replace(/\s+/g, '')
    .replace(/[.,!?'"“”‘’`~()[\]{}<>:;·…\-_]/g, '')
    .toLowerCase();

export const validateCondensedVoiceMemo = (value, originalText = '') => {
    if (typeof value !== 'string') return null;

    const condensed = sanitizeAIText(value).trim();
    if (!condensed) return null;
    if (condensed.length > 60) return null;

    const wordCount = condensed.split(/\s+/).filter(Boolean).length;
    if (wordCount > 8) return null;

    if (CONDENSE_VOICE_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(condensed))) {
        return null;
    }

    const originalComparable = normalizeComparableText(originalText);
    const condensedComparable = normalizeComparableText(condensed);
    if (
        originalComparable &&
        condensedComparable &&
        originalComparable === condensedComparable &&
        originalComparable.length > 20
    ) {
        return null;
    }

    return condensed;
};

const cleanJSONLikeValue = (value) => {
    if (value === null || value === undefined) return '';
    return sanitizeAIText(String(value)
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/^\s*[{,]?\s*"?/g, '')
        .replace(/"?\s*[,}]?\s*$/g, '')
        .trim());
};

const POLISH_PLACEHOLDER_VALUES = new Set([
    'text',
    'string',
    'polished',
    'polished text',
    '다듬어진 상담 기록 텍스트',
]);

const isUsablePolishedText = (value) => {
    const cleaned = cleanJSONLikeValue(value);
    if (!cleaned) return '';
    if (POLISH_PLACEHOLDER_VALUES.has(cleaned.trim().toLowerCase())) return '';
    return cleaned;
};

const extractPolishedReviewText = (payload) => {
    const parsed = parseFirstJSONObject(payload);
    if (parsed && typeof parsed === 'object') {
        const fields = ['polished', 'text', 'content', 'result', 'review', 'data'];
        for (const field of fields) {
            const value = isUsablePolishedText(parsed[field]);
            if (value) return value;
        }
        return '';
    }

    return isUsablePolishedText(stripJSONDecorators(payload));
};

const extractLooseField = (text, fieldName) => {
    const cleaned = stripJSONDecorators(text);
    if (!cleaned) return '';

    const nextFieldPattern = '"?(?:summary|fortune|relationship|work|money|care|action|luckyColor|luckyItem)"?\\s*[:\uff1a]';
    const pattern = new RegExp(`"?${fieldName}"?\\s*[:：]\\s*([\\s\\S]*?)(?=,?\\s*${nextFieldPattern}|\\s*}\\s*$|$)`, 'i');
    const match = cleaned.match(pattern);
    if (!match?.[1]) return '';

    return cleanJSONLikeValue(match[1]);
};

export const normalizeDailyFortunePayload = (payload) => {
    if (!payload) return null;

    const normalizeObject = (source) => {
        const nested = typeof source.fortune === 'string' ? parseFirstJSONObject(source.fortune) : null;
        if (nested) return normalizeDailyFortunePayload({ ...source, ...nested });

        const fortuneText = typeof source.fortune === 'string' ? source.fortune : '';
        const pick = (fieldName) => {
            const looseValue = extractLooseField(fortuneText, fieldName);
            return cleanJSONLikeValue(fieldName === 'fortune' ? (looseValue || source[fieldName]) : (source[fieldName] || looseValue));
        };
        const normalized = {
            ...source,
            summary: pick('summary') || '오늘의 메시지',
            fortune: pick('fortune') || '오늘의 운세를 불러오지 못했습니다. 잠시 숨을 고르고 차분하게 하루를 시작해 보세요.',
            relationship: pick('relationship') || '상대의 속도를 존중하며 부드럽게 대화해 보세요.',
            work: pick('work') || '가장 중요한 일 하나를 먼저 정리해 보세요.',
            money: pick('money') || '충동적인 선택보다 필요한 지출인지 한 번 더 확인해 보세요.',
            care: pick('care') || '무리하지 말고 컨디션의 작은 신호를 살펴보세요.',
            action: pick('action') || '오늘 할 일 하나를 적고 바로 시작해 보세요.',
            luckyColor: pick('luckyColor') || '골드',
            luckyItem: pick('luckyItem') || '작은 노트',
        };

        const parsedDrawCount = Number(normalized.drawCount);
        normalized.drawCount = Number.isFinite(parsedDrawCount) && parsedDrawCount > 0 ? parsedDrawCount : 1;
        normalized.drawnAt = normalized.drawnAt || new Date().toISOString();
        return normalized;
    };

    if (typeof payload === 'object') return normalizeObject(payload);

    const parsed = parseFirstJSONObject(payload);
    if (parsed) return normalizeDailyFortunePayload(parsed);

    const raw = stripJSONDecorators(payload);
    return normalizeObject({
        summary: extractLooseField(raw, 'summary'),
        fortune: extractLooseField(raw, 'fortune') || cleanJSONLikeValue(raw),
        relationship: extractLooseField(raw, 'relationship'),
        work: extractLooseField(raw, 'work'),
        money: extractLooseField(raw, 'money'),
        care: extractLooseField(raw, 'care'),
        action: extractLooseField(raw, 'action'),
        luckyColor: extractLooseField(raw, 'luckyColor'),
        luckyItem: extractLooseField(raw, 'luckyItem'),
    });
};


// 프롬프트는 ai-proxy 가 서버에서 만든다. 여기서는 작업 이름과 입력값만 보낸다.
const callAIProxy = async (task, input, { signal } = {}) => {
    try {
        const authState = await ensureAuthenticatedSession();
        if (!authState.ok) {
            return { data: null, error: authState.error };
        }


        const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { task, input },
            headers: {
                'x-customer-session-token': authState.session.token,
            },
            signal,
        });

        // 실패 code(db-redesign §2-1): AD_REQUIRED · AD_PENDING · QUOTA_EXCEEDED · INVALID_SESSION 등
        if (error) return { data: null, error: await readFunctionError(error) };

        // Validate AI response structure
        if (typeof data?.data !== 'string' || !data.data.trim()) {
            return {
                data: null,
                error: new Error('AI response data is invalid or empty.'),
            };
        }


        return { data: sanitizeAIText(data.data), error: null };
    } catch (error) {
        return { data: null, error };
    }
};

// ─────────────────────────────────────────────────────────────
// 1. 상담 기록 AI 요약/분석
// ─────────────────────────────────────────────────────────────

// ai-proxy 가 한 번에 받는 상담 기록 수 상한과 같다.
const MAX_ANALYZE_VISITS = 50;

export const analyzeVisitHistory = async (visits, signal = null) => {
    const validVisits = visits.filter(v => v.card_review?.trim());

    if (validVisits.length === 0) {
        return { data: null, error: new Error('분석할 상담 기록이 없습니다.') };
    }

    const input = {
        visits: validVisits.slice(0, MAX_ANALYZE_VISITS).map((v) => ({
            date: v.visit_date?.split('T')[0] || '',
            review: v.card_review,
        })),
    };

    const { data, error } = await callAIProxy('analyzeVisitHistory', input, { signal });

    if (error) return { data: null, error };

    try {
        const parsed = parseFirstJSONObject(data);
        if (!parsed) throw new Error('AI JSON parse failed.');
        // Robust key validation and fallback mapping
        const result = {
            overallSummary: parsed.overallSummary || '전체 요약이 없습니다.',
            patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
            growthPoints: parsed.growthPoints || '',
            recommendation: parsed.recommendation || '',
            totalVisits: parsed.totalVisits || input.visits.length
        };
        return { data: result, error: null };
    } catch {
        return {
            data: { overallSummary: data, patterns: [], growthPoints: '', recommendation: '', totalVisits: input.visits.length },
            error: null,
        };
    }
};

export const polishReviewText = async (reviewText, signal = null) => {
    if (!reviewText?.trim()) {
        return { data: null, error: new Error('다듬을 상담 기록이 없습니다.') };
    }

    const { data, error } = await callAIProxy('polishReviewText', { text: reviewText }, { signal });
    if (error) return { data: null, error };

    const polished = extractPolishedReviewText(data);
    if (!polished) {
        return { data: null, error: new Error('AI 문장 다듬기 결과가 비어 있습니다. 다시 시도해 주세요.') };
    }

    return { data: polished, error: null };
};

// ─────────────────────────────────────────────────────────────
// 2. 음성 메모 축약
// ─────────────────────────────────────────────────────────────

export const condenseVoiceMemo = async (transcriptText, signal = null) => {
    if (!transcriptText?.trim()) {
        return { data: null, error: new Error('축약할 메모가 없습니다.') };
    }

    const { data, error } = await callAIProxy('condenseVoiceMemo', { text: transcriptText }, { signal });
    if (error) return { data: null, error };

    try {
        const parsed = parseFirstJSONObject(data);
        if (!parsed) throw new Error('AI JSON parse failed.');
        const condensed = validateCondensedVoiceMemo(parsed.condensed, transcriptText);
        if (!condensed) throw new Error('AI condensed memo validation failed.');
        return { data: condensed, error: null };
    } catch {
        return { data: null, error: new Error(CONDENSE_VOICE_MEMO_SAFE_ERROR) };
    }
};

// ─────────────────────────────────────────────────────────────
// 3. 오늘의 운세 (Daily Fortune)
// ─────────────────────────────────────────────────────────────

/**
 * 보상형 광고에 실을 일회용 nonce 를 받는다. 광고를 끝까지 보면 AdMob 이 서버(admob-ssv)에
 * 이 nonce 로 보상을 알리고, 다시 뽑기 요청이 그 보상을 하나 소모한다.
 */
export const issueAdRewardNonce = async () => {
    try {
        const authState = await ensureAuthenticatedSession();
        if (!authState.ok) return { data: null, error: authState.error };

        const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
            body: { task: 'issueAdRewardNonce' },
            headers: { 'x-customer-session-token': authState.session.token },
        });
        if (error) return { data: null, error: await readFunctionError(error) };
        if (typeof data?.nonce !== 'string') return { data: null, error: new Error('Ad reward nonce was not issued.') };
        return { data: data.nonce, error: null };
    } catch (error) {
        return { data: null, error };
    }
};

const AD_PENDING_RETRY_DELAYS_MS = [1000, 1500, 2000, 3000, 4000];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getDailyFortune = async (userName = '사용자', previousFortune = '', cardContext = null, usageOptions = {}) => {
    const input = { userName, previousFortune: String(previousFortune || ''), card: cardContext || {} };
    if (usageOptions.adNonce) input.adNonce = usageOptions.adNonce;

    let { data, error } = await callAIProxy('getDailyFortune', input, { signal: usageOptions.signal || null });
    // 광고를 닫은 직후에는 Google 의 서버 콜백이 아직 안 왔을 수 있다. 잠깐씩 기다렸다 다시 묻는다.
    for (const delay of AD_PENDING_RETRY_DELAYS_MS) {
        if (error?.code !== 'AD_PENDING') break;
        await wait(delay);
        ({ data, error } = await callAIProxy('getDailyFortune', input, { signal: usageOptions.signal || null }));
    }
    if (error) return { data: null, error };

    try {
        const parsed = parseFirstJSONObject(data);
        if (!parsed) throw new Error('AI JSON parse failed.');
        return { data: normalizeDailyFortunePayload(parsed), error: null };
    } catch {
        return { data: normalizeDailyFortunePayload(data), error: null };
    }
};
