/**
 * src/services/aiService.js
 * AI service wrapper for the Supabase Edge Function proxy.
 */

import { ensureAuthenticatedSession, supabase, withAuthErrorHandling } from './supabase';

const EDGE_FUNCTION_NAME = 'ai-proxy';

const stringifyError = (errorValue) => {
  if (!errorValue) return '';
  if (typeof errorValue === 'string') return errorValue;
  try { return JSON.stringify(errorValue); } catch { return String(errorValue); }
};

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
  const cleaned = stripJSONDecorators(text);
  const start = cleaned.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (escaped) { escaped = false; continue; }
    if (inString && char === '\\') { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return cleaned.slice(start, i + 1);
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
    if (escaped) { result += char; escaped = false; continue; }
    if (inString && char === '\\') { result += char; escaped = true; continue; }
    if (char === '"') { inString = !inString; result += char; continue; }
    if (inString && char === '\n') { result += '\\n'; continue; }
    if (inString && char === '\r') { result += '\\r'; continue; }
    result += char;
  }
  return result;
};

const parseFirstJSONObject = (text) => {
  if (text && typeof text === 'object') return text;
  const jsonText = extractFirstJSONObject(text);
  if (!jsonText) return null;
  try { return JSON.parse(jsonText); } catch {
    try { return JSON.parse(escapeNewlinesInJSONString(jsonText).replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
  }
};

const collapseDegenerateKoreanRepeats = (text) => (
  typeof text === 'string' ? text.replace(/([\u3131-\u318E\uAC00-\uD7A3])\1{3,}/g, '$1') : ''
);

const collapseDegenerateWordRepeats = (text) => (
  typeof text === 'string' ? text.replace(/\b([\p{L}\p{N}][\p{L}\p{N}'’]{1,30})(?:\s+\1\b){2,}/giu, '$1') : ''
);

const sanitizeAIText = (text) => collapseDegenerateWordRepeats(collapseDegenerateKoreanRepeats(String(text || '')));

const cleanJSONLikeValue = (value) => {
  if (value === null || value === undefined) return '';
  return sanitizeAIText(String(value)
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/^\s*[{,]?\s*"?/g, '')
    .replace(/"?\s*[,}]?\s*$/g, '')
    .trim());
};

const extractLooseField = (text, fieldName) => {
  const cleaned = stripJSONDecorators(text);
  if (!cleaned) return '';
  const malformedQuotedKey = cleaned.match(new RegExp(`"${fieldName}:([^"]*)"`, 'i'));
  if (malformedQuotedKey?.[1]) return cleanJSONLikeValue(malformedQuotedKey[1]);
  const nextFieldPattern = '"?(?:summary|fortune|relationship|work|money|care|action|luckyColor|luckyItem)"?\\s*[:：]';
  const pattern = new RegExp(`"?${fieldName}"?\\s*[:：]\\s*([\\s\\S]*?)(?=,?\\s*${nextFieldPattern}|\\s*}\\s*$|$)`, 'i');
  const match = cleaned.match(pattern);
  return match?.[1] ? cleanJSONLikeValue(match[1]) : '';
};

export const normalizeDailyFortunePayload = (payload) => {
  const defaults = {
    summary: '오늘의 메시지',
    fortune: '오늘의 운세를 불러오지 못했습니다. 잠시 숨을 고르고 차분하게 하루를 시작해 보세요.',
    relationship: '상대의 속도를 존중하며 부드럽게 대화해 보세요.',
    work: '가장 중요한 일 하나를 먼저 정리해 보세요.',
    money: '충동적인 선택보다 필요한 지출인지 한 번 더 확인해 보세요.',
    care: '무리하지 말고 컨디션의 작은 신호를 살펴보세요.',
    action: '오늘 할 일 하나를 적고 바로 시작해 보세요.',
    luckyColor: '골드',
    luckyItem: '작은 노트',
  };

  const normalizeObject = (source = {}) => {
    const nested = typeof source.fortune === 'string' ? parseFirstJSONObject(source.fortune) : null;
    if (nested) return normalizeDailyFortunePayload({ ...source, ...nested });
    const fortuneText = typeof source.fortune === 'string' ? source.fortune : '';
    const pick = (fieldName) => {
      const looseValue = extractLooseField(fortuneText, fieldName);
      return cleanJSONLikeValue(fieldName === 'fortune' ? (looseValue || source[fieldName]) : (source[fieldName] || looseValue));
    };
    const normalized = Object.fromEntries(Object.keys(defaults).map((key) => [key, pick(key) || defaults[key]]));
    const parsedDrawCount = Number(source.drawCount);
    normalized.drawCount = Number.isFinite(parsedDrawCount) && parsedDrawCount > 0 ? parsedDrawCount : 1;
    normalized.drawnAt = source.drawnAt || new Date().toISOString();
    return normalized;
  };

  if (payload && typeof payload === 'object') return normalizeObject(payload);
  const parsed = parseFirstJSONObject(payload);
  if (parsed) return normalizeDailyFortunePayload(parsed);
  const raw = stripJSONDecorators(payload);
  return normalizeObject({
    summary: extractLooseField(raw, 'summary'),
    fortune: extractLooseField(raw, 'fortune') || cleanJSONLikeValue(payload),
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
    detailedError.quota = payload?.quota || null;
    return detailedError;
  } catch { return error; }
};

const callAIProxy = async (messages, options = {}, task = 'chat') => {
  try {
    const { temperature = 0.7, maxTokens = 1000, signal } = options;
    const authState = await ensureAuthenticatedSession();
    if (!authState.ok) {
      return { data: null, error: withAuthErrorHandling(authState.error, '로그인이 필요합니다. 다시 로그인해 주세요.') };
    }

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: { task, messages, options: { temperature, maxTokens } },
      headers: { 'x-customer-session-token': authState.session.token },
      signal,
    });

    if (error) {
      const detailedError = await withFunctionErrorDetails(error);
      return { data: null, error: withAuthErrorHandling(detailedError, 'AI 요청에 실패했습니다.') };
    }

    if (!data || data.error) {
      const proxyError = new Error(stringifyError(data?.error) || 'AI 응답을 받지 못했습니다.');
      proxyError.quota = data?.quota || null;
      return { data: null, error: proxyError };
    }

    if (typeof data.data !== 'string' || !data.data.trim()) {
      return { data: null, error: new Error('AI 응답 데이터가 비어 있거나 올바르지 않습니다.') };
    }

    return {
      data: sanitizeAIText(data.data),
      usage: data.usage,
      quota: data.quota || null,
      provider: data.provider,
      error: null,
    };
  } catch (error) {
    return { data: null, error: withAuthErrorHandling(error, 'AI 서비스 연동 중 오류가 발생했습니다.') };
  }
};

export const summarizeReview = async (reviewText, visitDate = '', signal = null) => {
  if (!reviewText?.trim()) return { data: null, error: new Error('상담 기록이 없습니다.') };
  const messages = [
    { role: 'system', content: `당신은 타로 상담 기록을 정리하는 assistant입니다. 상담자가 쓴 메모를 분석해 JSON만 출력하세요. 사실을 새로 만들지 말고 원문의 의미를 보존하세요.\n\n{\n  "summary": "2-3문장 핵심 요약",\n  "keywords": ["키워드1", "키워드2", "키워드3"],\n  "mood": "긍정/중립/복잡/어려움 중 하나",\n  "moodEmoji": "분위기에 맞는 이모지 1개",\n  "advice": "다음 상담을 위한 짧은 제안"\n}` },
    { role: 'user', content: `방문 날짜: ${visitDate}\n\n상담 기록:\n${reviewText}` },
  ];
  const { data, error } = await callAIProxy(messages, { temperature: 0.5, maxTokens: 500, signal }, 'summarizeReview');
  if (error) return { data: null, error };
  const parsed = parseFirstJSONObject(data);
  return { data: parsed ? {
    summary: parsed.summary || '요약 결과를 불러오지 못했습니다.',
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    mood: parsed.mood || '중립',
    moodEmoji: parsed.moodEmoji || '📝',
    advice: parsed.advice || '',
  } : { summary: data, keywords: [], mood: '중립', moodEmoji: '📝', advice: '' }, error: null };
};

export const analyzeVisitHistory = async (visits, signal = null) => {
  const validVisits = visits.filter(v => v.card_review?.trim());
  if (validVisits.length === 0) return { data: null, error: new Error('분석할 상담 기록이 없습니다.') };
  const visitsText = validVisits.map((v, i) => `[${i + 1}번째 방문 - ${v.visit_date?.split('T')[0] || '날짜 없음'}]\n${v.card_review}`).join('\n\n---\n\n');
  const messages = [
    { role: 'system', content: `당신은 타로 상담 기록을 종합 분석하는 assistant입니다. 여러 방문 메모를 바탕으로 반복 주제와 변화 흐름을 정리하세요. JSON만 출력하고, 없는 사실을 만들지 마세요.\n\n{\n  "overallSummary": "전체 흐름 2-3문장 요약",\n  "patterns": ["반복 주제 1", "반복 주제 2", "반복 주제 3"],\n  "growthPoints": "방문을 거치며 보이는 변화",\n  "recommendation": "향후 상담 방향 제안",\n  "totalVisits": ${validVisits.length}\n}` },
    { role: 'user', content: `총 ${validVisits.length}회의 상담 기록을 분석해 주세요:\n\n${visitsText}` },
  ];
  const { data, error, quota } = await callAIProxy(messages, { temperature: 0.5, maxTokens: 800, signal }, 'analyzeVisitHistory');
  if (error) return { data: null, error };
  const parsed = parseFirstJSONObject(data);
  return { data: parsed ? {
    overallSummary: parsed.overallSummary || '전체 요약이 없습니다.',
    patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
    growthPoints: parsed.growthPoints || '',
    recommendation: parsed.recommendation || '',
    totalVisits: parsed.totalVisits || validVisits.length,
  } : { overallSummary: data, patterns: [], growthPoints: '', recommendation: '', totalVisits: validVisits.length }, quota, error: null };
};

export const polishReviewText = async (reviewText, signal = null) => {
  if (!reviewText?.trim()) return { data: null, error: new Error('다듬을 상담 기록이 없습니다.') };
  const messages = [
    { role: 'system', content: `당신은 타로 상담 기록 문장을 정리하는 assistant입니다. 원문의 의미와 사실을 보존하고, 문장만 자연스럽게 다듬으세요. JSON만 출력하세요.\n\n{\n  "polished": "다듬어진 상담 기록"\n}` },
    { role: 'user', content: `아래 메모를 다듬어 주세요:\n\n${reviewText}` },
  ];
  const { data, error } = await callAIProxy(messages, { temperature: 0.4, maxTokens: 600, signal }, 'polishReviewText');
  if (error) return { data: null, error };
  const parsed = parseFirstJSONObject(data);
  return { data: parsed?.polished || data || '', error: null };
};

const TAROT_SYSTEM_PROMPT = `당신은 'drawer' 타로 상담 앱의 AI 상담 assistant입니다. 따뜻하고 신중하게 한국어로 답변하세요. 과도한 예언, 불안 조성, 의학/법률/재정 확정 조언은 피하고 필요하면 전문가 상담을 권하세요. 답변은 보통 3-5문장으로 간결하게 작성하세요.`;

export const condenseVoiceMemo = async (transcriptText, signal = null) => {
  if (!transcriptText?.trim()) return { data: null, error: new Error('축약할 음성 기록이 없습니다.') };
  const messages = [
    {
      role: 'system',
      content: `당신은 상담 기록과 음성 메모를 정리하는 assistant입니다.\n원문의 의미를 보존하고, 사실을 새로 만들지 마세요.\n핵심만 3~6문장으로 자연스럽게 정리하세요.\n반드시 JSON만 출력하세요.\n\n{\n  "condensed": "정리된 상담/음성 메모"\n}`,
    },
    { role: 'user', content: `아래 음성 기록을 정리해 주세요:\n\n${transcriptText}` },
  ];
  const { data, error, quota } = await callAIProxy(messages, { temperature: 0.35, maxTokens: 500, signal }, 'condenseVoiceMemo');
  if (error) return { data: null, error };
  const parsed = parseFirstJSONObject(data);
  return { data: parsed?.condensed || data || '', quota, error: null };
};

export const sendChatMessage = async (conversationHistory, userMessage) => {
  const messages = [{ role: 'system', content: TAROT_SYSTEM_PROMPT }, ...conversationHistory, { role: 'user', content: userMessage }];
  return callAIProxy(messages, { temperature: 0.8, maxTokens: 600 }, 'sendChatMessage');
};

const stringifyCardContext = (cardContext = {}) => {
  const domains = cardContext.domains || {};
  return `id: ${cardContext.id || ''}\nname: ${cardContext.name || ''}\nnameKr: ${cardContext.nameKr || ''}\nkeywords: ${(cardContext.keywords || []).join(', ')}\nlight: ${cardContext.light || ''}\nshadow: ${cardContext.shadow || ''}\nadvice: ${cardContext.advice || ''}\n\n[분야별 참고]\n관계: ${domains.relationship || ''}\n일/공부: ${domains.work || ''}\n금전: ${domains.money || ''}\n컨디션: ${domains.health || ''}`;
};

export const getDailyFortune = async (userName = '사용자', previousFortune = '', cardContext = null, usageOptions = {}) => {
  const messages = [
    { role: 'system', content: `당신은 drawer 앱의 오늘의 타로 메시지를 작성하는 해석자입니다. 사용자가 이미 선택한 카드 context만 바탕으로 한국어 조언을 작성하세요. AI가 카드를 바꾸거나 새로 선택하지 마세요. 과도한 예언, 불안 조성, 확정 표현은 금지입니다. 반드시 JSON만 출력하세요.` },
    { role: 'user', content: `[사용자]\n이름: ${userName || '사용자'}\n${previousFortune ? `이전 오늘 운세 요약: ${String(previousFortune).substring(0, 120)}` : ''}\n\n[오늘의 카드]\n${stringifyCardContext(cardContext || {})}\n\n[출력 JSON]\n{\n  "summary": "오늘의 핵심 메시지",\n  "fortune": "오늘의 운세 본문",\n  "relationship": "관계 조언",\n  "work": "일/공부 조언",\n  "money": "금전 조언",\n  "care": "주의할 점",\n  "action": "오늘 바로 할 수 있는 구체적 행동",\n  "luckyColor": "행운의 색",\n  "luckyItem": "행운의 아이템"\n}` },
  ];
  const { data, error } = await callAIProxy(messages, { temperature: 0.75, maxTokens: 700, signal: usageOptions.signal || null }, 'getDailyFortune');
  if (error) return { data: null, error };
  return { data: normalizeDailyFortunePayload(parseFirstJSONObject(data) || data), error: null };
};

export default { summarizeReview, analyzeVisitHistory, polishReviewText, sendChatMessage, condenseVoiceMemo, getDailyFortune, normalizeDailyFortunePayload };
