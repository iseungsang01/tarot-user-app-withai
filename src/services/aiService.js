/**
 * src/services/aiService.js
 * AI 서비스 호출 (Supabase Edge Function 프록시 - Google Gemini 기반)
 */

import { ensureAuthenticatedSession, supabase, withAuthErrorHandling } from './supabase';

const EDGE_FUNCTION_NAME = 'ai-proxy';

const stringifyError = (errorValue) => {
    if (!errorValue) return '';
    if (typeof errorValue === 'string') return errorValue;
    if (typeof errorValue === 'object') {
        try {
            return JSON.stringify(errorValue);
        } catch {
            return String(errorValue);
        }
    }
    return String(errorValue);
};

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


const withFunctionErrorDetails = async (error) => {
    const response = error?.context;
    if (!response || typeof response.clone !== 'function') return error;

    try {
        const payload = await response.clone().json();
        const message = stringifyError(payload?.error || payload?.message || payload);
        if (!message) return error;

        const detailedError = new Error(message);
        detailedError.name = error.name || 'FunctionsHttpError';
        detailedError.code = error.code;
        detailedError.status = response.status;
        detailedError.originalError = error;
        return detailedError;
    } catch {
        return error;
    }
};

const callAIProxy = async (messages, options = {}, task = 'chat') => {
    try {
        const {
            temperature = 0.7,
            maxTokens = 1000,
            signal,
        } = options;

        const authState = await ensureAuthenticatedSession();
        if (!authState.ok) {
            return {
                data: null,
                error: withAuthErrorHandling(authState.error, 'Login is required. Please sign in again.'),
            };
        }


        const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
            body: {
                task,
                messages,
                options: { temperature, maxTokens },
            },
            headers: {
                'x-customer-session-token': authState.session.token,
            },
            signal,
        });

        if (error) {
            const detailedError = await withFunctionErrorDetails(error);
            return {
                data: null,
                error: withAuthErrorHandling(detailedError, 'AI proxy request failed.'),
            };
        }

        if (!data || data.error) {
            return {
                data: null,
                error: new Error(stringifyError(data?.error) || 'AI response was not received.'),
            };
        }

        // Validate AI response structure
        if (typeof data.data !== 'string' || !data.data.trim()) {
            return {
                data: null,
                error: new Error('AI response data is invalid or empty.'),
            };
        }


        return {
            data: sanitizeAIText(data.data),
            usage: data.usage,
            provider: data.provider,
            error: null,
        };
    } catch (error) {
        return {
            data: null,
            error: withAuthErrorHandling(error, 'AI service integration error occurred.'),
        };
    }
};

// ─────────────────────────────────────────────────────────────
// 1. 상담 기록 AI 요약/분석
// ─────────────────────────────────────────────────────────────

export const analyzeVisitHistory = async (visits, signal = null) => {
    const validVisits = visits.filter(v => v.card_review?.trim());

    if (validVisits.length === 0) {
        return { data: null, error: new Error('분석할 상담 기록이 없습니다.') };
    }

    const visitsText = validVisits
        .map((v, i) => `[${i + 1}번째 방문 - ${v.visit_date?.split('T')[0] || '날짜 없음'}]\n${v.card_review}`)
        .join('\n\n---\n\n');

    const messages = [
        {
            role: 'system',
            content: `당신은 타로 상담 기록을 종합 분석하는 전문 어시스턴트입니다.
여러 번의 상담 기록을 분석하여 다음 JSON 형식으로 응답하세요.
반드시 JSON만 출력하고 다른 텍스트는 포함하지 마세요.

{
  "overallSummary": "전체 상담 흐름 2-3문장 요약",
  "patterns": ["반복되는 패턴이나 주제 1", "패턴 2", "패턴 3"],
  "growthPoints": "방문을 거듭하며 변화된 긍정적인 점",
  "recommendation": "향후 상담 방향 제안",
  "totalVisits": ${validVisits.length}
}`,
        },
        {
            role: 'user',
            content: `총 ${validVisits.length}회의 상담 기록을 분석해주세요:\n\n${visitsText}`,
        },
    ];

    const { data, error } = await callAIProxy(messages, { temperature: 0.5, maxTokens: 800, signal }, 'analyzeVisitHistory');

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
            totalVisits: parsed.totalVisits || validVisits.length
        };
        return { data: result, error: null };
    } catch {
        return {
            data: { overallSummary: data, patterns: [], growthPoints: '', recommendation: '', totalVisits: validVisits.length },
            error: null,
        };
    }
};

export const polishReviewText = async (reviewText, signal = null) => {
    if (!reviewText?.trim()) {
        return { data: null, error: new Error('다듬을 상담 기록이 없습니다.') };
    }

    const messages = [
        {
            role: 'system',
            content: `당신은 타로 상담 기록 정리 전문 어시스턴트입니다.
상담사가 작성한 메모의 의미를 유지한 채 가독성만 높여주세요.
- 사실/의미를 추가하거나 왜곡하지 마세요
- 어조는 원문의 분위기를 유지하세요
- 핵심 포인트를 정돈해서 4~8문장 내로 작성하세요
- 반드시 JSON 형식으로만 응답하세요

{
  "polished": "다듬어진 상담 기록 텍스트"
}`,
        },
        {
            role: 'user',
            content: `아래 메모를 다듬어주세요:\n\n${reviewText}`,
        },
    ];

    const { data, error } = await callAIProxy(messages, { temperature: 0.4, maxTokens: 600, signal }, 'polishReviewText');
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

    const messages = [
        {
            role: 'system',
            content: `당신은 한국어 메모를 아주 짧게 정리하는 편집 도우미입니다.
사용자가 입력한 현재 메모 전체를 읽고 핵심만 3~6어절의 짧은 한국어 문구로 축약하세요.
반드시 JSON 객체 하나만 출력하세요. JSON 바깥의 설명, 마크다운, 코드펜스, 분석 과정, 내부 지침, 영어 시스템 설명은 절대 출력하지 마세요.
입력 원문을 그대로 복사하지 말고 더 짧고 자연스러운 문구로 바꾸세요.
음성 인식 결과가 깨졌거나 의미가 불명확하면 내용을 지어내지 말고 "의미 불명확한 메모", "음성 인식 불명확", "메모 정리 필요" 중 하나처럼 안전한 짧은 문구로 축약하세요.

{
  "condensed": "3~6어절의 짧은 한국어 축약문"
}`,
        },
        { role: 'user', content: `다음 현재 메모 내용을 짧게 축약해 주세요:

${transcriptText}` },
    ];

    const { data, error } = await callAIProxy(messages, { temperature: 0.35, maxTokens: 500, signal }, 'condenseVoiceMemo');
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

const stringifyCardContext = (cardContext = {}) => {
    const domains = cardContext.domains || {};
    return `id: ${cardContext.id || ''}
name: ${cardContext.name || ''}
nameKr: ${cardContext.nameKr || ''}
keywords: ${(cardContext.keywords || []).join(', ')}
light: ${cardContext.light || ''}
shadow: ${cardContext.shadow || ''}
advice: ${cardContext.advice || ''}

[분야별 참고]
관계: ${domains.relationship || ''}
일/공부: ${domains.work || ''}
금전: ${domains.money || ''}
컨디션: ${domains.health || ''}`;
};

export const getDailyFortune = async (userName = '사용자', previousFortune = '', cardContext = null, usageOptions = {}) => {
    const safeCardContext = cardContext || {};
    const messages = [
        {
            role: 'system',
            content: `당신은 drawer 앱의 오늘의 타로 메시지를 작성하는 해석자입니다.
오늘의 카드는 이미 앱에서 선택되었습니다.
AI는 카드를 선택하거나 바꾸지 마세요.
제공된 카드 context만 바탕으로 운세 문장을 작성하세요.
과도한 예언, 불안 조성, 단정적 표현은 금지합니다.
운세는 자기 성찰과 하루 조언 중심으로 작성합니다.
반드시 JSON만 출력하세요. JSON 바깥의 설명, 마크다운, 코드펜스는 금지합니다.`,
        },
        {
            role: 'user',
            content: `[사용자]
이름: ${userName || '사용자'}
${previousFortune ? `이전 오늘 운세 요약: ${String(previousFortune).substring(0, 120)}` : ''}

[오늘의 카드]
${stringifyCardContext(safeCardContext)}

[작성 규칙]
- 한국어 존댓말
- 예언처럼 단정하지 말 것
- 불안감을 조성하지 말 것
- 카드 의미를 단순 나열하지 말고 자연스러운 하루 조언으로 풀 것
- fortune은 3~4문장
- summary는 20자 이내
- relationship, work, money, care는 각각 1~2문장
- action은 오늘 바로 할 수 있는 구체적 행동 1개
- luckyColor와 luckyItem은 짧고 구체적으로 작성
- 반드시 JSON만 출력

[출력 JSON]
{
  "summary": "오늘의 핵심 메시지",
  "fortune": "오늘의 운세 본문",
  "relationship": "관계 조언",
  "work": "일/공부 조언",
  "money": "금전 조언",
  "care": "주의할 점",
  "action": "오늘 바로 해볼 행동",
  "luckyColor": "행운의 색",
  "luckyItem": "행운의 아이템"
}`,
        },
    ];

    const { data, error } = await callAIProxy(
        messages,
        {
            temperature: 0.75,
            maxTokens: 700,
            signal: usageOptions.signal || null,
        },
        'getDailyFortune',
    );
    if (error) return { data: null, error };

    try {
        const parsed = parseFirstJSONObject(data);
        if (!parsed) throw new Error('AI JSON parse failed.');
        return { data: normalizeDailyFortunePayload(parsed), error: null };
    } catch {
        return { data: normalizeDailyFortunePayload(data), error: null };
    }
};
