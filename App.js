import { useEffect } from 'react';
import { Platform, StatusBar, View } from 'react-native';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppDialog, ErrorBoundary, GlobalErrorDisplay } from './src/components';
import AppNavigator from './src/navigation/AppNavigator';
import { initializeAdMob } from './src/services/rewardedAdService';
import { DrawerTheme } from './src/constants/DrawerTheme';
import { FONT_ASSETS } from './src/constants/Typography';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function App() {
  // 본문 서체가 올라오기 전에 그리면 시스템 서체로 한 번 찍혔다가 바뀌어 글자가 튄다.
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);

  useEffect(() => {
    initializeAdMob();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const styleId = 'tarot-cellar-mobile-preview-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box; }
      html, body, #root {
        margin: 0;
        width: 100%;
        min-height: 100%;
        height: 100%;
        overflow: hidden;
        overflow-x: hidden;
        background: #09000D;
      }
      #root {
        max-width: 393px;
        margin: 0 auto;
      }
      [data-testid="history-scroll"] {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      [data-testid="history-scroll"]::-webkit-scrollbar {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }, []);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: DrawerTheme.bgBlackPurple }} />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <AuthProvider>
              <StatusBar
                barStyle="light-content"
                backgroundColor="#1a0033"
              />
              <AppNavigator />
              <GlobalErrorDisplay />
              <AppDialog />
            </AuthProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
