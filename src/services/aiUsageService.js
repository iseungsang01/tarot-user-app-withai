import { AI_USAGE_LIMITS } from '../constants/Config';
import { ensureAuthenticatedSession, withAuthErrorHandling } from './supabase';
import { supabaseClient } from './supabaseClient';

export const AI_USAGE_TYPES = {
  SUMMARIZE_REVIEW: 'summarize_review',
  ANALYZE_VISIT_HISTORY: 'analyze_visit_history',
  POLISH_REVIEW_TEXT: 'polish_review_text',
  SEND_CHAT_MESSAGE: 'send_chat_message',
  GET_WELCOME_MESSAGE: 'get_welcome_message',
  DAILY_FORTUNE_REDRAW: 'daily_fortune_redraw',
};

const TASK_USAGE_TYPES = {
  summarizeReview: AI_USAGE_TYPES.SUMMARIZE_REVIEW,
  analyzeVisitHistory: AI_USAGE_TYPES.ANALYZE_VISIT_HISTORY,
  polishReviewText: AI_USAGE_TYPES.POLISH_REVIEW_TEXT,
  sendChatMessage: AI_USAGE_TYPES.SEND_CHAT_MESSAGE,
  getWelcomeMessage: AI_USAGE_TYPES.GET_WELCOME_MESSAGE,
  dailyFortuneRedraw: AI_USAGE_TYPES.DAILY_FORTUNE_REDRAW,
};

export const resolveAIUsageType = (task) => TASK_USAGE_TYPES[task] || task;

export const getCurrentMonthBucket = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const getMonthlyLimit = (usageType) => AI_USAGE_LIMITS?.monthly?.[usageType] ?? null;

const buildLimitError = (usageType, limit, currentCount) => {
  const error = new Error('Monthly AI usage limit reached. Please try again next month.');
  error.code = 'AI_MONTHLY_LIMIT_EXCEEDED';
  error.usageType = usageType;
  error.limit = limit;
  error.currentCount = currentCount;
  return error;
};

const getSessionToken = async () => {
  const authState = await ensureAuthenticatedSession();
  if (!authState.ok) {
    return {
      token: null,
      error: withAuthErrorHandling(authState.error, 'Login is required. Please sign in again.'),
    };
  }
  return { token: authState.session.access_token, error: null };
};

export const getMyAIUsage = async (monthBucket) => {
  const { token, error: sessionError } = await getSessionToken();
  if (sessionError) return { data: null, error: sessionError };

  // Omit p_month_bucket if not provided so Supabase RPC defaults to server time (now())
  const payload = {
    p_session_token: token,
  };
  if (monthBucket !== undefined) {
    payload.p_month_bucket = monthBucket;
  }

  const { data, error } = await supabaseClient.getMyAIUsage(payload);

  if (error) {
    return { data: null, error: withAuthErrorHandling(error, 'Failed to load AI usage.') };
  }

  return { data: Array.isArray(data) ? data : [], error: null };
};

export const getMyAIUsageCount = async (usageType, monthBucket) => {
  const { data, error } = await getMyAIUsage(monthBucket);
  if (error) return { count: 0, error };

  const row = data.find((item) => item.usage_type === usageType);
  return { count: Number(row?.usage_count || 0), error: null };
};

export const ensureAIUsageAllowed = async (usageType, monthBucket) => {
  const limit = getMonthlyLimit(usageType);
  if (limit === null || limit === undefined) return { allowed: true, currentCount: 0, limit: null, error: null };

  const { count, error } = await getMyAIUsageCount(usageType, monthBucket);
  if (error) return { allowed: false, currentCount: 0, limit, error };
  if (count >= limit) return { allowed: false, currentCount: count, limit, error: buildLimitError(usageType, limit, count) };

  return { allowed: true, currentCount: count, limit, error: null };
};

export const incrementMyAIUsage = async (usageType, increment = 1, monthBucket) => {
  const { token, error: sessionError } = await getSessionToken();
  if (sessionError) return { data: null, error: sessionError };

  // Omit p_month_bucket if not provided so Supabase RPC defaults to server time (now())
  const payload = {
    p_session_token: token,
    p_usage_type: usageType,
    p_increment: increment,
  };
  if (monthBucket !== undefined) {
    payload.p_month_bucket = monthBucket;
  }

  const { data, error } = await supabaseClient.incrementMyAIUsage(payload);

  if (error) {
    return { data: null, error: withAuthErrorHandling(error, 'Failed to record AI usage.') };
  }

  return { data, error: null };
};
