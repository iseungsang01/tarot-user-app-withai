/**
 * src/services/openaiService.js
 * OpenAI API 호출 서비스
 * - 상담 기록 요약/분석
 * - 대화형 AI 챗봇
 */

import { supabase } from './supabase';

const OPENAI_API_KEY = (process.env.EXPO_PUBLIC_OPENAI_API_KEY || '').trim();
const GOOGLE_API_KEY = (process.env.EXPO_PUBLIC_GOOGLE_API_KEY || '').trim();

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

/**
 * OpenAI 서버 상태 관리 변수
 */
let openAIStatus = {
    isHealthy: true,
    lastChecked: 0,
    failureCount: 0
};

const FAILURE_THRESHOLD = 2; // 연속 2회 실패 시 잠시 OpenAI 건너뜀
const RETRY_AFTER = 5 * 60 * 1000; // 5분 후 다시 시도


const callOpenAI = async (messages, options = {}) => {
    const {
        temperature = 0.7,
        maxTokens = 1000,
    } = options;

    const now = Date.now();

    // 1. OpenAI 상태 확인 (최근에 실패가 많았고 5분이 안 지났으면 바로 Google AI로)
    const shouldSkipOpenAI = !openAIStatus.isHealthy && (now - openAIStatus.lastChecked < RETRY_AFTER);

    if (!OPENAI_API_KEY || shouldSkipOpenAI) {
        if (shouldSkipOpenAI) {
            console.log('OpenAI is currently marked as unhealthy. Skipping to Google AI...');
        } else {
            console.log('OpenAI API Key is missing. Using Google AI...');
        }
        return await callGoogleAI(messages, options);
    }

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
            const errorData = await response.json().catch(() => ({}));
            const rawMessage = errorData.error?.message || '';

            // 상태 업데이트: 실패 기록
            openAIStatus.failureCount++;
            openAIStatus.lastChecked = now;
            if (openAIStatus.failureCount >= FAILURE_THRESHOLD) {
                openAIStatus.isHealthy = false;
            }

            console.log(`OpenAI failure (${response.status}): ${rawMessage}. Falling back to Google AI...`);
            return await callGoogleAI(messages, options);
        }

        // 성공하면 상태 초기화
        openAIStatus.isHealthy = true;
        openAIStatus.failureCount = 0;
        openAIStatus.lastChecked = now;

        const data = await response.json();
        return {
            data: data.choices[0]?.message?.content || '',
            usage: data.usage,
            error: null,
        };
    } catch (error) {
        console.log('OpenAI Connection error, falling back to Google AI...', error.message);

        // 상태 업데이트: 실패 기록
        openAIStatus.failureCount++;
        openAIStatus.lastChecked = now;
        if (openAIStatus.failureCount >= FAILURE_THRESHOLD) {
            openAIStatus.isHealthy = false;
        }

        return await callGoogleAI(messages, options);
    }
};



import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Google Gemini/Gemma AI SDK 설정
 */
const genAI = GOOGLE_API_KEY ? new GoogleGenerativeAI(GOOGLE_API_KEY) : null;
const GOOGLE_MODEL_NAME = 'gemma-3-27b-it';

/**
 * Google AI SDK를 사용한 호출 함수 (시스템 지침 에러 대응)
 */
const callGoogleAI = async (messages, options = {}) => {
    const {
        temperature = 0.7,
        maxTokens = 1000,
    } = options;

    if (!genAI) {
        return { data: null, error: new Error('Google API Key is missing') };
    }

    try {
        const model = genAI.getGenerativeModel({
            model: GOOGLE_MODEL_NAME,
            generationConfig: {
                temperature: temperature,
                maxOutputTokens: maxTokens,
            }
        });

        // OpenAI 메시지 형식을 Gemini/Gemma 형식으로 변환
        const systemMessage = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');

        const contents = [];
        let lastRole = null;

        // Gemma 3 등 일부 모델은 systemInstruction을 지원하지 않으므로 본문에 포함
        let systemPromptPrefix = systemMessage ? `[시스템 지침]\n${systemMessage.content}\n\n---\n\n` : '';

        for (let i = 0; i < chatMessages.length; i++) {
            const m = chatMessages[i];
            const role = (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user';

            let contentText = m.content;

            // 첫 번째 메시지가 user인 경우 시스템 지침을 병합
            if (i === 0 && role === 'user' && systemPromptPrefix) {
                contentText = systemPromptPrefix + contentText;
                systemPromptPrefix = ''; // 적용 완료
            }

            if (role === lastRole && contents.length > 0) {
                contents[contents.length - 1].parts[0].text += '\n\n' + contentText;
            } else {
                contents.push({
                    role: role,
                    parts: [{ text: contentText }]
                });
                lastRole = role;
            }
        }

        // 지침이 남아있거나(메시지가 없었던 경우) 첫 메시지가 model인 경우 처리
        if (systemPromptPrefix && contents.length === 0) {
            contents.push({ role: 'user', parts: [{ text: systemPromptPrefix + "대화를 시작합니다." }] });
        } else if (contents.length > 0 && contents[0].role === 'model') {
            contents.unshift({
                role: 'user',
                parts: [{ text: systemPromptPrefix || '이전 대화 맥락입니다.' }]
            });
        }

        const result = await model.generateContent({ contents });
        const response = await result.response;
        const content = response.text();

        return {
            data: content,
            usage: response.usageMetadata,
            error: null,
        };
    } catch (error) {
        console.error('Google AI SDK Error:', error.message);

        let userFriendlyMessage = '시스템 연동 오류이거나 할당량이 부족합니다.';
        if (error.message.includes('API Key') || error.message.includes('key')) {
            userFriendlyMessage = 'API 설정 오류';
        } else if (error.message.includes('quota') || error.message.includes('429')) {
            userFriendlyMessage = 'AI 할당량 초과';
        }

        return { data: userFriendlyMessage, error };
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
 * AI 상담 사용량 증가 및 체크
 * @param {string} customerId 
 */
export const incrementAIUsage = async (customerId) => {
    if (!customerId || customerId === 'guest') return { success: true };

    try {
        const { data, error } = await supabase.rpc('increment_ai_usage', {
            p_customer_id: customerId
        });

        if (error) {
            console.error('Supabase RPC Error (increment_ai_usage):', error);
            return {
                success: false,
                message: `서버 연결 오류가 발생했습니다. (${error.message || 'Unknown'})`
            };
        }

        // RPC에서 성공 여부를 담은 객체를 반환하므로 그대로 반환
        if (data && typeof data === 'object') {
            return data;
        }

        return { success: false, message: '알 수 없는 오류가 발생했습니다.' };
    } catch (error) {
        console.error('Increment AI Usage Catch Error:', error);
        return {
            success: false,
            message: `상담 횟수 확인 중 연동 오류가 발생했습니다. (${error.message})`
        };
    }
};


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

/**
 * 오늘의 운세 생성
 * @param {string} userName 
 * @param {string} previousFortune - 이전에 뽑은 운세 내용 (중복 방지용)
 */
export const getDailyFortune = async (userName = '사용자', previousFortune = '') => {
    const messages = [
        {
            role: 'system',
            content: `당신은 오늘의 운세를 알려주는 신비로운 타로 상담사입니다.
사용자의 이름을 부르며, 오늘 하루를 위한 따뜻한 조언과 운세를 제공하세요.
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

    const { data, error } = await callOpenAI(messages, { temperature: 0.9, maxTokens: 450 });
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
    incrementAIUsage,
    sendChatMessage,
    getWelcomeMessage,
    getDailyFortune,
};