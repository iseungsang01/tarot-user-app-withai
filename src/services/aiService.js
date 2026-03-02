/**
 * src/services/aiService.js
 * AI 서비스 호출 (Supabase Edge Function 프록시 - Google Gemini 기반)
 */

import { supabaseClient } from './supabaseClient';
import { ensureAuthenticatedSession, supabase } from './supabase';

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

const callAIProxy = async (messages, options = {}, task = 'chat') => {
    try {
        const { data, error } = await supabaseClient.invokeAIProxy({
            task,
            messages,
            options: {
                temperature: options.temperature ?? 0.7,
                maxTokens: options.maxTokens ?? 1000,
        const authState = await ensureAuthenticatedSession();
        if (!authState.ok) {
            return {
                data: null,
                error: new Error(authState.error?.message || '로그인이 필요합니다. 다시 로그인해주세요.'),
            };
        }

        const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
            body: {
                task,
                messages,
                options: {
                    temperature: options.temperature ?? 0.7,
                    maxTokens: options.maxTokens ?? 1000,
                },
            },
            headers: {
                Authorization: `Bearer ${authState.session.access_token}`,
            },
        });

        if (error) {
            return {
                data: null,
                error: new Error(error.message || 'AI 프록시 호출 중 오류가 발생했습니다.'),
            };
        }

        if (!data || data.error) {
            return {
                data: null,
                error: new Error(stringifyError(data?.error) || 'AI 응답을 받지 못했습니다.'),
            };
        }

        return {
            data: data.data,
            usage: data.usage,
            provider: data.provider,
            error: null,
        };
    } catch (error) {
        return {
            data: null,
            error: new Error(error.message || 'AI 서비스 연동 오류가 발생했습니다.'),
        };
    }
};

// ─────────────────────────────────────────────────────────────
// 1. 상담 기록 AI 요약/분석
// ─────────────────────────────────────────────────────────────

export const summarizeReview = async (reviewText, visitDate = '') => {
    if (!reviewText?.trim()) {
        return { data: null, error: new Error('상담 기록이 없습니다.') };
    }

    const messages = [
        {
            role: 'system',
            content: `당신은 타로 상담 기록을 분석하는 전문 어시스턴트입니다.
상담사가 작성한 메모를 분석하여 다음 JSON 형식으로 응답하세요.
반드시 JSON만 출력하고 다른 텍스트는 포함하지 마세요.

{
  "summary": "2-3문장으로 핵심 요약",
  "keywords": ["키워드1", "키워드2", "키워드3"],
  "mood": "상담 분위기 (긍정적/중립/복잡/어려움 중 하나)",
  "moodEmoji": "분위기에 맞는 이모지 1개",
  "advice": "다음 상담을 위한 한 줄 제안"
}`,
        },
        {
            role: 'user',
            content: `방문 날짜: ${visitDate}\n\n상담 기록:\n${reviewText}`,
        },
    ];

    const { data, error } = await callAIProxy(messages, { temperature: 0.5, maxTokens: 500 }, 'summarizeReview');

    if (error) return { data: null, error };

    try {
        const cleanedData = data.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleanedData);
        return { data: parsed, error: null };
    } catch {
        return {
            data: { summary: data, keywords: [], mood: '중립', moodEmoji: '📝', advice: '' },
            error: null,
        };
    }
};

export const analyzeVisitHistory = async (visits) => {
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

    const { data, error } = await callAIProxy(messages, { temperature: 0.5, maxTokens: 800 }, 'analyzeVisitHistory');

    if (error) return { data: null, error };

    try {
        const cleanedData = data.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleanedData);
        return { data: parsed, error: null };
    } catch {
        return {
            data: { overallSummary: data, patterns: [], growthPoints: '', recommendation: '' },
            error: null,
        };
    }
};

export const polishReviewText = async (reviewText) => {
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

    const { data, error } = await callAIProxy(messages, { temperature: 0.4, maxTokens: 600 }, 'polishReviewText');
    if (error) return { data: null, error };

    try {
        const cleanedData = data.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleanedData);
        return { data: parsed.polished || '', error: null };
    } catch {
        return { data, error: null };
    }
};

// ─────────────────────────────────────────────────────────────
// 2. 대화형 AI 챗봇
// ─────────────────────────────────────────────────────────────

const TAROT_SYSTEM_PROMPT = `당신은 'drawer'라는 타로 상담 앱의 AI 상담 어시스턴트입니다.
따뜻하고 신비로운 타로 상담사의 페르소나를 가지고 있습니다.

역할과 원칙:
- 사용자의 고민에 공감하고, 타로 카드의 상징과 의미를 활용하여 통찰을 제공합니다
- 단정 짓지 않고, 사용자 스스로 답을 찾을 수 있도록 안내합니다
- 과학적으로 검증되지 않은 예언은 하지 않으며, 심리적 지지와 자기 성찰을 돕습니다
- 답변은 3-5문장으로 간결하게, 한국어로 응답합니다
- 필요시 관련 타로 카드를 1-2장 언급하며 설명을 보강합니다
- 매우 심각한 정신건강 문제는 전문가 상담을 권유합니다

말투: 따뜻하고 신비로운 어조, 존댓말 사용`;

export const sendChatMessage = async (conversationHistory, userMessage) => {
    const messages = [
        { role: 'system', content: TAROT_SYSTEM_PROMPT },
        ...conversationHistory,
        { role: 'user', content: userMessage },
    ];

    return callAIProxy(messages, { temperature: 0.8, maxTokens: 600 }, 'sendChatMessage');
};

export const getWelcomeMessage = async () => {
    const messages = [
        { role: 'system', content: TAROT_SYSTEM_PROMPT },
        {
            role: 'user',
            content: '안녕하세요, 처음 방문했습니다. 인사와 함께 어떤 고민이든 편하게 이야기할 수 있다고 따뜻하게 맞이해주세요.',
        },
    ];

    return callAIProxy(messages, { temperature: 0.9, maxTokens: 200 }, 'getWelcomeMessage');
};

// ─────────────────────────────────────────────────────────────
// 3. 오늘의 운세 (Daily Fortune)
// ─────────────────────────────────────────────────────────────

export const getDailyFortune = async (userName = '사용자', previousFortune = '', cardName = '') => {
    const messages = [
        {
            role: 'system',
            content: `당신은 오늘의 운세를 알려주는 신비로운 타로 상담사입니다.
사용자의 이름을 부르며, 오늘 하루를 위한 따뜻한 조언과 운세를 제공하세요.
${cardName ? `사용자가 뽑은 타로 카드는 '${cardName}'입니다. 이 카드의 상징과 의미를 바탕으로 오늘의 운세를 해석해주세요.` : '오늘의 타로 카드를 하나 선정하여 그 의미를 바탕으로 운세를 알려주세요.'}
답변은 3-4문장 정도로 간결하고 희망차게 작성하세요.

${previousFortune ? `중요: 사용자가 이미 '${previousFortune.substring(0, 50)}...'라는 내용의 운세를 확인했습니다.
이번에는 이전과는 다른 새로운 관점, 다른 타로 카드 상징, 혹은 다른 테마(재물, 인간관계, 건강 등)에 집중하여 '전혀 다른' 운세를 작성해주세요.` : ''}

반드시 JSON 형식으로 응답하세요:
{
  "fortune": "오늘의 운세 내용 (이전과는 다른 새로운 내용)",
  "luckyColor": "추천 행운의 색상",
  "luckyItem": "행운의 아이템"
}`,
        },
        {
            role: 'user',
            content: `${userName}님의 오늘의 운세를 알려주세요.${previousFortune ? ' 방금 전과는 다른 새로운 운세를 원합니다.' : ''}`,
        },
    ];

    const { data, error } = await callAIProxy(messages, { temperature: 0.9, maxTokens: 450 }, 'getDailyFortune');
    if (error) return { data: null, error };

    try {
        const cleanedData = data.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleanedData);
        return { data: parsed, error: null };
    } catch {
        return { data: { fortune: data, luckyColor: '', luckyItem: '' }, error: null };
    }
};

export default {
    summarizeReview,
    analyzeVisitHistory,
    polishReviewText,
    sendChatMessage,
    getWelcomeMessage,
    getDailyFortune,
};
