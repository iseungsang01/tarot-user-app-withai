import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../constants/Colors';
import { GradientBackground, LoadingSpinner } from '../components';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import OnboardingScreen from '../screens/OnboardingScreen';

import { STORAGE_KEYS } from '../constants/Config';

const AppNavigator = () => {
  const { customer, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(true);

  useEffect(() => {
    const hydrateOnboardingState = async () => {
      try {
        if (!customer) {
          setShowOnboarding(false);
          return;
        }

        const seen = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING);
        setShowOnboarding(!seen);
      } finally {
        setOnboardingLoading(false);
      }
    };

    setOnboardingLoading(true);
    hydrateOnboardingState();
  }, [customer]);

  const handleCloseOnboarding = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING, 'true');
    setShowOnboarding(false);
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
      {customer ? (showOnboarding ? <OnboardingScreen onClose={handleCloseOnboarding} /> : <MainNavigator />) : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default AppNavigator;
