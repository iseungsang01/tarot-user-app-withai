import React, { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { UIProvider } from './src/context/UIContext';
import { ErrorProvider } from './src/context/ErrorContext';
import { ErrorBoundary, GlobalErrorDisplay } from './src/components';
import AppNavigator from './src/navigation/AppNavigator';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function App() {
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

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <ErrorProvider>
              <AuthProvider>
                <UIProvider>
                  <StatusBar
                    barStyle="light-content"
                    backgroundColor="#1a0033"
                  />
                  <AppNavigator />
                  <GlobalErrorDisplay />
                </UIProvider>
              </AuthProvider>
            </ErrorProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
