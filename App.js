import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ErrorProvider } from './src/context/ErrorContext';
import { ErrorBoundary, GlobalErrorDisplay } from './src/components';
import AppNavigator from './src/navigation/AppNavigator';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <ErrorProvider>
              <AuthProvider>
                <StatusBar
                  barStyle="light-content"
                  backgroundColor="#1a0033"
                />
                <AppNavigator />
                <GlobalErrorDisplay />
              </AuthProvider>
            </ErrorProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}