import { storage } from '../utils/storage';
import { STORAGE_KEYS } from '../utils/storage/core';

/** 저장된 고객 RPC 세션 토큰 (없으면 null) */
const getCustomerSessionToken = async () => {
  const session = await storage.get(STORAGE_KEYS.CUSTOMER_SESSION);
  return session?.token || null;
};

/** 세션 토큰을 요구하는 RPC용. 토큰이 없으면 재로그인 유도 에러를 던진다. */
export const requireCustomerSessionToken = async () => {
  const token = await getCustomerSessionToken();
  if (!token) {
    const error = new Error('Login is required. Please sign in again.');
    error.code = 'AUTH_REQUIRED';
    error.requiresReLogin = true;
    throw error;
  }
  return token;
};
