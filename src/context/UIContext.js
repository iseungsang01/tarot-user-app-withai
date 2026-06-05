import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/Config';
import { AuthContext } from './AuthContext';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const { customer } = useContext(AuthContext);
  const [showCoachMarks, setShowCoachMarks] = useState(false);
  const [coachMarksSessionId, setCoachMarksSessionId] = useState(null);
  const [uiLoading, setUiLoading] = useState(true);

  const startCoachMarks = useCallback((sessionId) => {
    const nextSessionId = sessionId ?? `${Date.now()}`;
    setCoachMarksSessionId(nextSessionId);
    setShowCoachMarks(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const hydrateUIState = async () => {
      setUiLoading(true);
      try {
        if (!customer) {
          if (isMounted) {
            setShowCoachMarks(false);
            setCoachMarksSessionId(null);
          }
          return;
        }

        const hasSeenCoachMarks = await AsyncStorage.getItem(STORAGE_KEYS.COACH_MARKS);
        if (isMounted && hasSeenCoachMarks !== 'true') {
          startCoachMarks(`first-run-${customer.id ?? Date.now()}`);
        } else if (isMounted) {
          setShowCoachMarks(false);
          setCoachMarksSessionId(null);
        }
      } catch (error) {
        console.error('UIContext.hydrateUIState error:', error);
      } finally {
        if (isMounted) setUiLoading(false);
      }
    };

    hydrateUIState();

    return () => {
      isMounted = false;
    };
  }, [customer?.id, startCoachMarks]);

  const completeCoachMarks = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.COACH_MARKS, 'true');
      setShowCoachMarks(false);
      setCoachMarksSessionId(null);
    } catch (error) {
      console.error('UIContext.completeCoachMarks error:', error);
    }
  }, []);

  const triggerCoachMarks = useCallback(
    (sessionId) => {
      startCoachMarks(sessionId ?? `replay-${Date.now()}`);
    },
    [startCoachMarks]
  );

  return (
    <UIContext.Provider
      value={{
        showCoachMarks,
        coachMarksSessionId,
        uiLoading,
        completeCoachMarks,
        startCoachMarks,
        triggerCoachMarks,
      }}
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
