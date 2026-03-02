import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../constants/Colors';
import { GradientBackground } from '../components/GradientBackground';
import { LoadingSpinner } from '../components/LoadingSpinner';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import OnboardingScreen from '../screens/OnboardingScreen';

export const ONBOARDING_KEY = 'has_seen_main_onboarding_v1';

/**
 * 메인 네비게이터
 * 인증 상태에 따라 AuthNavigator 또는 MainNavigator 표시
 */
const AppNavigator = () => {
  const { customer, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(true);

  useEffect(() => {
    const hydrateOnboardingState = async () => {
      if (!customer) {
        setShowOnboarding(false);
        setOnboardingLoading(false);
        return;
      }

      const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
      setShowOnboarding(!seen);
      setOnboardingLoading(false);
    };

    hydrateOnboardingState();
  }, [customer]);

  const handleCloseOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  };

  // 앱 초기 로딩 중
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
