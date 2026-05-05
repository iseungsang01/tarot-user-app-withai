import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { logError } from '../utils/errorHandler';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  const initializeAuth = useCallback(async () => {
    try {
      const storedCustomer = await authService.getStoredCustomer();
      if (storedCustomer) setCustomer(storedCustomer);
    } catch (error) {
      logError('AuthContext.initializeAuth', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const login = async (phoneNumber, password) => {
    try {
      const { data, error } = await authService.login(phoneNumber, password);
      if (data) setCustomer(data);
      return { data, error };
    } catch (error) {
      logError('AuthContext.login', error, { phoneNumber });
      return { data: null, error: { message: '로그인 중 오류가 발생했습니다.' } };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setCustomer(null);
    } catch (error) {
      logError('AuthContext.logout', error);
    }
  };

  const refreshCustomer = async () => {
    if (!customer || customer.isGuest) return;

    try {
      const refreshed = await authService.refreshCustomer(customer.id);
      if (refreshed) setCustomer(refreshed);
    } catch (error) {
      logError('AuthContext.refreshCustomer', error, { customerId: customer?.id });
    }
  };

  const guestLogin = async () => {
    try {
      const guestUser = { id: 'guest', nickname: '게스트', isGuest: true, current_stamps: 0, visit_count: 0 };
      setCustomer(guestUser);
      return { data: guestUser, error: null };
    } catch (error) {
      logError('AuthContext.guestLogin', error);
      return { data: null, error: { message: '게스트 로그인 실패' } };
    }
  };

  const register = async (phoneNumber, password, nickname) => {
    try {
      const { data, error } = await authService.register(phoneNumber, password, nickname);
      if (data) setCustomer(data); // 가입 즉시 로그인 상태로 전환
      return { data, error };
    } catch (error) {
      logError('AuthContext.register', error, { phoneNumber });
      return { data: null, error: { message: '회원가입 중 오류가 발생했습니다.' } };
    }
  };

  return (
    <AuthContext.Provider value={{ customer, loading, login, logout, refreshCustomer, guestLogin, register }}>
      {children}
    </AuthContext.Provider>
  );
};
