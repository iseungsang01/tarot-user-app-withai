import { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { errorEmitter } from '../utils/errorEmitter';

const ErrorContext = createContext();

export const ErrorProvider = ({ children }) => {
  const [error, setError] = useState(null);

  const hideError = useCallback(() => {
    console.log('✅ [ErrorContext] 에러 숨김');
    setError(null);
  }, []);

  const showError = useCallback((errorInfo) => {
    console.log('🔴 [ErrorContext] 에러 표시:', errorInfo);
    setError(errorInfo);
    setTimeout(hideError, 3000);
  }, [hideError]);

  // errorEmitter 구독: 서비스/유틸 레이어에서 발행한 에러를 Context로 연결
  useEffect(() => {
    const unsubscribe = errorEmitter.subscribe(showError);
    return unsubscribe;
  }, [showError]);

  return (
    <ErrorContext.Provider value={{ error, showError, hideError }}>
      {children}
    </ErrorContext.Provider>
  );
};

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) throw new Error('useError must be used within ErrorProvider');
  return context;
};
