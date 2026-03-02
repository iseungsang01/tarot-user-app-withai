import React, { createContext, useState, useEffect, useContext } from 'react';
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
            try {
                if (!customer) {
                    setShowCoachMarks(false);
                    return;
                }

                const seen = await AsyncStorage.getItem(STORAGE_KEYS.COACH_MARKS);
                setShowCoachMarks(!seen);
            } catch (error) {
                console.error('UIContext.hydrateUIState error:', error);
            } finally {
                setUiLoading(false);
            }
        };

        setUiLoading(true);
        hydrateUIState();
    }, [customer]);

    const completeCoachMarks = async () => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.COACH_MARKS, 'true');
            setShowCoachMarks(false);
        } catch (error) {
            console.error('UIContext.completeCoachMarks error:', error);
        }
    };

    const triggerCoachMarks = () => {
        setShowCoachMarks(true);
    };

    const value = {
        showCoachMarks,
        uiLoading,
        completeCoachMarks,
        triggerCoachMarks,
    };

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};
