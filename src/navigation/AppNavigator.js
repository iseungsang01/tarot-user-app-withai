import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../constants/Colors';
import { GradientBackground, LoadingSpinner } from '../components';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

import { STORAGE_KEYS } from '../constants/Config';

const AppNavigator = () => {
  const { customer, loading } = useAuth();
  const [showCoachMarks, setShowCoachMarks] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(true);

  useEffect(() => {
    const hydrateOnboardingState = async () => {
      try {
        if (!customer) {
          setShowCoachMarks(false);
          return;
        }

        const seen = await AsyncStorage.getItem(STORAGE_KEYS.COACH_MARKS);
        setShowCoachMarks(!seen);
      } finally {
        setOnboardingLoading(false);
      }
    };

    setOnboardingLoading(true);
    hydrateOnboardingState();
  }, [customer]);

  const handleCloseCoachMarks = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.COACH_MARKS, 'true');
    setShowCoachMarks(false);
  };

  if (loading || onboardingLoading) {
    return (
      <GradientBackground>
        <LoadingSpinner message="앱 로딩 중..." />
      </GradientBackground>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          background: Colors.purpleDark,
          primary: Colors.gold,
          card: Colors.purpleMid,
          text: '#ffffff',
          border: Colors.purpleLight,
          notification: Colors.red,
        },
      }}
    >
      {customer ? (
        <MainNavigator shouldShowCoachMarks={showCoachMarks} onCompleteCoachMarks={handleCloseCoachMarks} />
      ) : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default AppNavigator;
