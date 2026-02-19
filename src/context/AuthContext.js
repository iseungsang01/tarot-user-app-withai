import React, { createContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { logError } from '../utils/errorHandler';

/**
 * 인증 Context
 * 전역 인증 상태 관리
 */
export const AuthContext = createContext();

/**
 * 인증 Provider
 * 앱 전체에 인증 상태 제공
 */
export const AuthProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * 컴포넌트 마운트 시 초기 인증 상태 확인
   */
  useEffect(() => {
    initializeAuth();
  }, []);

  /**
   * 초기 인증 상태 확인 로직
   */
  const initializeAuth = async () => {
    try {
      const storedCustomer = await authService.getStoredCustomer();
      if (storedCustomer) {
        setCustomer(storedCustomer);
      }
    } catch (error) {
      logError('AuthContext.initializeAuth', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 로그인
   * @param {string} phoneNumber - 전화번호
   * @param {string} password - 비밀번호
   * @returns {object} { data, error }
   */
  const login = async (phoneNumber, password) => {
    try {
      const { data, error } = await authService.login(phoneNumber, password);

      if (data) {
        setCustomer(data);
      }

      return { data, error };
    } catch (error) {
      logError('AuthContext.login', error, { phoneNumber });
      return {
        data: null,
        error: { message: '로그인 중 오류가 발생했습니다.' }
      };
    }
  };

  /**
   * 로그아웃
   */
  const logout = async () => {
    try {
      await authService.logout();
      setCustomer(null);
    } catch (error) {
      logError('AuthContext.logout', error);
    }
  };

  /**
   * 고객 정보 새로고침
   */
  const refreshCustomer = async () => {
    if (!customer || customer.isGuest) return;

    try {
      const refreshed = await authService.refreshCustomer(customer.id);
      if (refreshed) {
        setCustomer(refreshed);
      }
    } catch (error) {
      logError('AuthContext.refreshCustomer', error, { customerId: customer?.id });
    }
  };

  /**
   * 게스트 로그인
   */
  const guestLogin = async () => {
    console.log('AuthContext: guestLogin called'); // Debug Log
    try {
      const guestUser = {
        id: 'guest',
        nickname: '게스트',
        isGuest: true,
        current_stamps: 0,
        visit_count: 0
      };

      setCustomer(guestUser);
      return { data: guestUser, error: null };
    } catch (error) {
      logError('AuthContext.guestLogin', error);
      console.error('AuthContext: guestLogin failed', error); // Debug Log
      return { data: null, error: { message: '게스트 로그인 실패' } };
    }
  };

  /**
   * 회원가입
   */
  const register = async (phoneNumber, password, nickname) => {
    try {
      const { data, error } = await authService.register(phoneNumber, password, nickname);
      return { data, error };
    } catch (error) {
      logError('AuthContext.register', error, { phoneNumber });
      return { data: null, error: { message: '회원가입 중 오류가 발생했습니다.' } };
    }
  };

  const value = {
    customer,
    loading,
    login,
    logout,
    refreshCustomer,
    guestLogin,
    register,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};