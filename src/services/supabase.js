import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing!');
}

const AUTH_ERROR_CODES = new Set(['PGRST301', '401', '403']);
const REFRESH_THRESHOLD_SECONDS = 60;

let globalAuthErrorHandler = null;

export const normalizeAuthError = (error, fallbackMessage = '인증이 만료되었습니다. 다시 로그인해주세요.') => {
  const message = error?.message || fallbackMessage;
  return {
    message,
    code: error?.code || 'AUTH_REQUIRED',
    requiresReLogin: true,
    isAuthError: true,
  };
};

export const isAuthContextError = (error) => {
  if (!error) return false;

  if (AUTH_ERROR_CODES.has(String(error.code || ''))) return true;

  const message = (error.message || '').toLowerCase();
  return (
    message.includes('jwt')
    || message.includes('not authenticated')
    || message.includes('unauthorized')
    || message.includes('permission denied')
    || message.includes('auth')
  );
};

export const withAuthErrorHandling = (error, defaultMessage) => {
  if (isAuthContextError(error)) {
    const normalizedError = normalizeAuthError(error, defaultMessage);
    if (typeof globalAuthErrorHandler === 'function') {
      globalAuthErrorHandler(normalizedError);
    }
    return normalizedError;
  }
  return error;
};

export const setGlobalAuthErrorHandler = (handler) => {
  globalAuthErrorHandler = handler;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const ensureAuthenticatedSession = async () => {
  const reportAndFail = (error, fallbackMessage) => {
    const normalizedError = normalizeAuthError(error, fallbackMessage);
    if (typeof globalAuthErrorHandler === 'function') {
      globalAuthErrorHandler(normalizedError);
    }
    return { ok: false, error: normalizedError };
  };

  const attemptRefresh = async (fallbackMessage) => {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !refreshedData?.session?.access_token) {
      return reportAndFail(refreshError, fallbackMessage);
    }

    return { ok: true, session: refreshedData.session, error: null };
  };

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return reportAndFail(error);
  }

  const session = data?.session;
  if (!session?.access_token) {
    return attemptRefresh('인증 세션이 없어 자동 복구를 시도했지만 실패했습니다. 다시 로그인해주세요.');
  }

  const expiresAt = Number(session.expires_at || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const shouldRefresh = expiresAt > 0 && expiresAt - nowSeconds <= REFRESH_THRESHOLD_SECONDS;

  if (shouldRefresh) {
    return attemptRefresh('세션 만료 복구에 실패했습니다. 다시 로그인해주세요.');
  }

  return { ok: true, session, error: null };
};
