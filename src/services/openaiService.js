/**
 * src/services/openaiService.js
 * OpenAI API 호출 서비스
 * - 상담 기록 요약/분석
 * - 대화형 AI 챗봇
 */

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini'; // 비용 효율적인 모델 (gpt-4o로 변경 가능)

/**
 * 기본 OpenAI 호출 함수
 */
const callOpenAI = async (messages, options = {}) => {
    const {
        temperature = 0.7,
        maxTokens = 1000,
    } = options;

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                temperature,
                max_tokens: maxTokens,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            const rawMessage = errorData.error?.message || '';

            // 잔액 부족(Quota) 에러인 경우 'API 키 잔액 부족' 문자열 반환
            if (rawMessage.includes('quota') || response.status === 429) {
                return { data: 'API 키 잔액 부족', error: null };
            }

            throw new Error(rawMessage || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            data: data.choices[0]?.message?.content || '',
            usage: data.usage,
            error: null,
        };
    } catch (error) {
        return { data: null, error };
    }
};

// ─────────────────────────────────────────────────────────────
// 1. 상담 기록 AI 요약/분석
// ─────────────────────────────────────────────────────────────

/**
 * 단일 상담 기록 요약
 * @param {string} reviewText - 상담 기록 텍스트
 * @param {string} visitDate - 방문 날짜
 * @returns {{ summary, keywords, mood, advice }}
 */
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

    const { data, error } = await callOpenAI(messages, { temperature: 0.5, maxTokens: 500 });

    if (error) return { data: null, error };

    try {
        // JSON 파싱
        const cleanedData = data.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleanedData);
        return { data: parsed, error: null };
    } catch {
        // JSON 파싱 실패 시 raw 텍스트 반환
        return {
            data: { summary: data, keywords: [], mood: '중립', moodEmoji: '📝', advice: '' },
            error: null,
        };
    }
};

/**
 * 여러 상담 기록 종합 분석
 * @param {Array} visits - 방문 기록 배열 [{ visit_date, card_review }]
 * @returns {{ overallSummary, patterns, recommendation }}
 */
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

    const { data, error } = await callOpenAI(messages, { temperature: 0.5, maxTokens: 800 });

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

// ─────────────────────────────────────────────────────────────
// 2. 대화형 AI 챗봇
// ─────────────────────────────────────────────────────────────

/**
 * 타로 상담사 AI 시스템 프롬프트
 */
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

/**
 * 챗봇 메시지 전송
 * @param {Array} conversationHistory - 대화 히스토리 [{ role, content }]
 * @param {string} userMessage - 새 사용자 메시지
 * @returns {{ data: string, error }}
 */
export const sendChatMessage = async (conversationHistory, userMessage) => {
    const messages = [
        { role: 'system', content: TAROT_SYSTEM_PROMPT },
        ...conversationHistory,
        { role: 'user', content: userMessage },
    ];

    return await callOpenAI(messages, { temperature: 0.8, maxTokens: 600 });
};

/**
 * 대화 시작 인사 메시지 생성
 */
export const getWelcomeMessage = async () => {
    const messages = [
        { role: 'system', content: TAROT_SYSTEM_PROMPT },
        {
            role: 'user',
            content: '안녕하세요, 처음 방문했습니다. 인사와 함께 어떤 고민이든 편하게 이야기할 수 있다고 따뜻하게 맞이해주세요.',
        },
    ];

    return await callOpenAI(messages, { temperature: 0.9, maxTokens: 200 });
};