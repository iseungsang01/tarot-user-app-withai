import React, { createContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { authService } from '../services/authService';
import { setGlobalAuthErrorHandler } from '../services/supabase';
import { resetAuthNoticeState, shouldDisplayAuthNotice } from '../utils/authErrorNotice';
import { logError } from '../utils/errorHandler';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [loadingState, setLoadingState] = useState({
    initializing: true,
    loggingIn: false,
    loggingOut: false,
  });

  const handleAuthFailure = useCallback(async (authError = {}) => {
    try {
      await authService.logout();
      setCustomer(null);

      const message = authError?.message || '인증이 만료되었습니다. 다시 로그인해주세요.';
      if (shouldDisplayAuthNotice(message)) {
        Alert.alert('로그인 필요', message);
      }
    } catch (error) {
      logError('AuthContext.handleAuthFailure', error);
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    setLoadingState(prev => ({ ...prev, initializing: true }));
    try {
      const storedCustomer = await authService.getStoredCustomer();
      if (storedCustomer) setCustomer(storedCustomer);
    } catch (error) {
      logError('AuthContext.initializeAuth', error);
    } finally {
      setLoadingState(prev => ({ ...prev, initializing: false }));
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    setGlobalAuthErrorHandler(handleAuthFailure);

    return () => {
      setGlobalAuthErrorHandler(null);
    };
  }, [handleAuthFailure]);

  const login = async (phoneNumber, password) => {
    setLoadingState(prev => ({ ...prev, loggingIn: true }));
    try {
      const { data, error } = await authService.login(phoneNumber, password);
      if (data) setCustomer(data);
      if (data) resetAuthNoticeState();
      return { data, error };
    } catch (error) {
      logError('AuthContext.login', error, { phoneNumber });
      return { data: null, error: { message: '로그인 중 오류가 발생했습니다.' } };
    } finally {
      setLoadingState(prev => ({ ...prev, loggingIn: false }));
    }
  };

  const logout = async () => {
    setCustomer(null);
    setLoadingState(prev => ({ ...prev, loggingOut: true }));

    try {
      await authService.logout();
    } catch (error) {
      logError('AuthContext.logout', error);
    } finally {
      setLoadingState(prev => ({ ...prev, loggingOut: false }));
    }
  };

  const refreshCustomer = useCallback(async () => {
    if (!customer || customer.isGuest) return;

    try {
      const refreshed = await authService.refreshCustomer(customer.id);
      if (refreshed) setCustomer(refreshed);
    } catch (error) {
      logError('AuthContext.refreshCustomer', error, { customerId: customer?.id });
    }
  }, [customer?.id, customer?.isGuest]);

  const guestLogin = async () => {
    try {
      const guestUser = { id: 'guest', nickname: '게스트', isGuest: true, current_stamps: 0, visit_count: 0 };
      setCustomer(guestUser);
      resetAuthNoticeState();
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

  const loading = loadingState.initializing || loadingState.loggingIn || loadingState.loggingOut;

  return (
    <AuthContext.Provider value={{ customer, loading, loadingState, login, logout, refreshCustomer, guestLogin, register }}>
      {children}
    </AuthContext.Provider>
  );
};
