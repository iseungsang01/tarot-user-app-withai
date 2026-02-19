import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../constants/Colors';
import { GradientBackground } from '../components/GradientBackground';
import { LoadingSpinner } from '../components/LoadingSpinner';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

/**
 * 메인 네비게이터
 * 인증 상태에 따라 AuthNavigator 또는 MainNavigator 표시
 */
const AppNavigator = () => {
  const { customer, loading } = useAuth();

  // 앱 초기 로딩 중
  if (loading) {
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
      {customer ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default AppNavigator;