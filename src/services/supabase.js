import { createClient } from '@supabase/supabase-js';
import { coreStorage, STORAGE_KEYS } from '../utils/storage/core';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.error('Supabase URL or Anon Key is missing!');
}

const CUSTOMER_SESSION_KEY = STORAGE_KEYS.CUSTOMER_SESSION;

let globalAuthErrorHandler = null;
let cachedSupabaseClient = null;

const createSupabaseClient = () => {
  if (!hasSupabaseConfig) {
    throw new Error('supabaseKey is required.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
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

// 서버 오류의 reason 코드(db-redesign §2-1). RPC 는 MESSAGE 에, Edge Function 은 본문 code 에 담아
// 보낸다. Edge 쪽은 호출부가 본문을 꺼내 error.reason 에 넣어 둔다.
export const getErrorReason = (error) => error?.reason || error?.message || null;

const SESSION_EXPIRED_MESSAGE = '로그인이 만료되었습니다. 다시 로그인해주세요.';

const normalizeAuthError = (error, reason = 'INVALID_SESSION') => ({
  message: reason === 'PASSWORD_CHANGE_REQUIRED' ? '비밀번호를 먼저 변경해주세요.' : SESSION_EXPIRED_MESSAGE,
  code: error?.code || 'AUTH_REQUIRED',
  reason,
  requiresReLogin: reason === 'INVALID_SESSION',
  isAuthError: true,
});

// INVALID_SESSION 은 전역 로그아웃, PASSWORD_CHANGE_REQUIRED 는 강제 변경 화면으로 보낸다.
// 둘 다 AuthContext 의 전역 핸들러가 처리한다.
export const withAuthErrorHandling = (error) => {
  const reason = getErrorReason(error);
  if (reason !== 'INVALID_SESSION' && reason !== 'PASSWORD_CHANGE_REQUIRED') return error;

  const normalizedError = normalizeAuthError(error, reason);
  if (typeof globalAuthErrorHandler === 'function') {
    globalAuthErrorHandler(normalizedError);
  }
  return normalizedError;
};

const getCustomerRpcSession = async () => coreStorage.get(CUSTOMER_SESSION_KEY);

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

let pendingSessionPromise = null;

export const ensureAuthenticatedSession = async () => {
  if (pendingSessionPromise) {
    return pendingSessionPromise;
  }

  const runSessionCheck = async () => {
    const reportAndFail = () => {
      const normalizedError = normalizeAuthError(null);
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
          token: customerSession.token,
          customerId: customerSession.customerId,
          type: customerSession.type || 'customer',
        },
        error: null,
      };
    }

    return reportAndFail();
  };

  pendingSessionPromise = runSessionCheck();
  try {
    return await pendingSessionPromise;
  } finally {
    pendingSessionPromise = null;
  }
};
