import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { GradientBackground } from './GradientBackground';
import { Colors } from '../constants/Colors';
import { logError } from '../utils/errorHandler';

/**
 * Error Boundary Component
 * React 컴포넌트 트리에서 발생하는 에러를 잡아내고 폴백 UI 표시
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // 에러 발생 시 폴백 UI를 보여주도록 상태 업데이트
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 에러 로깅
    logError('ErrorBoundary', error, {
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <GradientBackground>
          <View style={styles.container}>
            <View style={styles.card}>
              <Text style={styles.icon}>⚠️</Text>
              <Text style={styles.title}>앱에 문제가 발생했습니다</Text>
              <Text style={styles.message}>
                예상치 못한 오류가 발생했습니다.{'\n'}
                앱을 다시 시작해주세요.
              </Text>

              {__DEV__ && this.state.error && (
                <View style={styles.errorDetails}>
                  <Text style={styles.errorDetailsTitle}>📋 개발자 정보:</Text>
                  <Text style={styles.errorDetailsText}>
                    {this.state.error.toString()}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.button}
                onPress={this.handleReset}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          </View>
        </GradientBackground>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: Colors.purpleMid,
    borderRadius: 20,
    padding: 40,
    width: '100%',
    maxWidth: 450,
    borderWidth: 3,
    borderColor: Colors.redSoft,
    alignItems: 'center',
  },
  icon: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gold,
    textAlign: 'center',
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    color: Colors.lavender,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  errorDetails: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    width: '100%',
  },
  errorDetailsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.redSoft,
    marginBottom: 8,
  },
  errorDetailsText: {
    fontSize: 12,
    color: Colors.lavender,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  button: {
    backgroundColor: Colors.gold,
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.purpleDark,
  },
});