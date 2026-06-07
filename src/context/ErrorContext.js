import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import { errorEmitter } from '../utils/errorEmitter';

const ErrorContext = createContext();

export const ErrorProvider = ({ children }) => {
  const [error, setError] = useState(null);
  const hideTimeoutRef = useRef(null);

  const hideError = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setError(null);
  }, []);

  const showError = useCallback((errorInfo) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setError(errorInfo);
    hideTimeoutRef.current = setTimeout(hideError, 3000);
  }, [hideError]);

  useEffect(() => {
    const unsubscribe = errorEmitter.subscribe(showError);
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      unsubscribe();
    };
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
