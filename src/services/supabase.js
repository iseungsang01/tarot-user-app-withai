import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing!');
}

const AUTH_ERROR_CODES = new Set(['PGRST301', '401', '403']);

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
    return normalizeAuthError(error, defaultMessage);
  }
  return error;
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
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return { ok: false, error: normalizeAuthError(error) };
  }

  if (!data?.session?.access_token) {
    return { ok: false, error: normalizeAuthError(null) };
  }

  return { ok: true, session: data.session, error: null };
};
