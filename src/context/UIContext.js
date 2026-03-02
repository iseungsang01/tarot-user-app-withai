import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/Config';
import { AuthContext } from './AuthContext';

export const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const { customer } = useContext(AuthContext);
  const [showCoachMarks, setShowCoachMarks] = useState(false);
  const [uiLoading, setUiLoading] = useState(true);

  useEffect(() => {
    const hydrateUIState = async () => {
      setUiLoading(true);
      try {
        if (!customer) return setShowCoachMarks(false);
        const seen = await AsyncStorage.getItem(STORAGE_KEYS.COACH_MARKS);
        setShowCoachMarks(!seen);
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
    } catch (error) {
      console.error('UIContext.completeCoachMarks error:', error);
    }
  }, []);

  const triggerCoachMarks = useCallback(() => setShowCoachMarks(true), []);

  return (
    <UIContext.Provider value={{ showCoachMarks, uiLoading, completeCoachMarks, triggerCoachMarks }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
};
