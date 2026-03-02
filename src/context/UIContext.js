import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/Config';
import { AuthContext } from './AuthContext';

export const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const { customer } = useContext(AuthContext);
  const [showCoachMarks, setShowCoachMarks] = useState(false);
  const [coachMarksSessionId, setCoachMarksSessionId] = useState(null);
  const [uiLoading, setUiLoading] = useState(true);

  useEffect(() => {
    const hydrateUIState = async () => {
      setUiLoading(true);
      try {
        if (!customer) return setShowCoachMarks(false);
        // 코치마크는 자동 노출 시 핵심 UI 터치를 가로채는 문제가 있어
        // 사용자가 명시적으로 요청한 경우에만 triggerCoachMarks()로 노출한다.
        // 저장된 완료 여부는 유지하되, 초기 진입에서 자동 활성화하지 않는다.
        await AsyncStorage.getItem(STORAGE_KEYS.COACH_MARKS);
        setShowCoachMarks(false);
      } catch (error) {
        console.error('UIContext.hydrateUIState error:', error);
      } finally {
        setUiLoading(false);
      }
    };

    hydrateUIState();
  }, [customer]);

  const completeCoachMarks = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.COACH_MARKS, 'true');
      setShowCoachMarks(false);
      setCoachMarksSessionId(null);
    } catch (error) {
      console.error('UIContext.completeCoachMarks error:', error);
    }
  }, []);

  const startCoachMarks = useCallback((sessionId) => {
    const nextSessionId = sessionId ?? `${Date.now()}`;
    setCoachMarksSessionId(nextSessionId);
    setShowCoachMarks(true);
  }, []);

  const triggerCoachMarks = useCallback((sessionId) => startCoachMarks(sessionId), [startCoachMarks]);

  return (
    <UIContext.Provider
      value={{ showCoachMarks, coachMarksSessionId, uiLoading, completeCoachMarks, startCoachMarks, triggerCoachMarks }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
};
