import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.error('Supabase URL or Anon Key is missing!');
}

const AUTH_ERROR_CODES = new Set(['PGRST301', '401', '403']);
const CUSTOMER_SESSION_KEY = 'tarot_customer_session';

let globalAuthErrorHandler = null;
let cachedSupabaseClient = null;

const createSupabaseClient = () => {
  if (!hasSupabaseConfig) {
    throw new Error('supabaseKey is required.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
};

export const getSupabase = () => {
  if (!cachedSupabaseClient) {
    cachedSupabaseClient = createSupabaseClient();
  }
  return cachedSupabaseClient;
};

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
    || message.includes('auth')
  );
};

const getCustomerRpcSession = async () => {
  try {
    const rawSession = await AsyncStorage.getItem(CUSTOMER_SESSION_KEY);
    return rawSession ? JSON.parse(rawSession) : null;
  } catch {
    return null;
  }
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

export const supabase = new Proxy({}, {
  get(_, prop) {
    const client = getSupabase();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
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

  const customerSession = await getCustomerRpcSession();
  if (customerSession?.token) {
    return {
      ok: true,
      session: {
        access_token: customerSession.token,
        customer_id: customerSession.customerId,
        type: 'customer_rpc_session',
      },
      error: null,
    };
  }

  return reportAndFail(null, '저장된 고객 세션이 없습니다. 다시 로그인해주세요.');
};
