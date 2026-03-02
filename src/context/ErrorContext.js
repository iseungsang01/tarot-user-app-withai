import React, { createContext, useState, useContext, useCallback } from 'react';

export const ErrorContext = createContext();

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

  global.showGlobalError = showError;

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
