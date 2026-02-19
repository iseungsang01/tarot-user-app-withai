import React, { createContext, useState, useContext } from 'react';

/**
 * 에러 Context
 * 전역 에러 상태 관리
 */
export const ErrorContext = createContext();

/**
 * 에러 Provider
 * 앱 전체에 에러 상태 제공
 */
export const ErrorProvider = ({ children }) => {
  const [error, setError] = useState(null);

  /**
   * 에러 표시
   * @param {object} errorInfo - 에러 정보 { type, title, message, icon }
   */
  const showError = (errorInfo) => {
    console.log('🔴 [ErrorContext] 에러 표시:', errorInfo);
    setError(errorInfo);

    // 3초 후 자동으로 에러 숨김
    setTimeout(() => {
      setError(null);
    }, 3000);
  };

  /**
   * 에러 숨김
   */
  const hideError = () => {
    console.log('✅ [ErrorContext] 에러 숨김');
    setError(null);
  };

  // 전역에서 접근 가능하도록 설정
  global.showGlobalError = showError;

  const value = {
    error,
    showError,
    hideError,
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};

/**
 * 에러 Hook
 * ErrorContext를 편리하게 사용하기 위한 커스텀 훅
 * 
 * @returns {object} { error, showError, hideError }
 * 
 * @example
 * const { showError, hideError } = useError();
 * 
 * // 에러 표시
 * showError({
 *   type: ERROR_TYPES.NETWORK,
 *   title: '네트워크 오류',
 *   message: '인터넷 연결을 확인해주세요.',
 *   icon: '📡',
 * });
 */
export const useError = () => {
  const context = useContext(ErrorContext);
  
  if (!context) {
    throw new Error('useError must be used within ErrorProvider');
  }
  
  return context;
};