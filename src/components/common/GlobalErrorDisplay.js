import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { errorEmitter } from '../../utils/errorEmitter';
import { Colors } from '../../constants/Colors';

const AUTO_HIDE_MS = 3000;

/**
 * 전역 에러 표시 컴포넌트
 * 화면 상단에 에러 토스트 메시지 표시
 *
 * 에러 흐름:
 *   서비스/유틸 → errorEmitter.emit()
 *   → GlobalErrorDisplay(구독) → 렌더링
 */
export const GlobalErrorDisplay = () => {
  const [error, setError] = useState(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const hideTimerRef = useRef(null);

  const hideError = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setError(null);
  }, []);

  useEffect(() => {
    const unsubscribe = errorEmitter.subscribe((errorInfo) => {
      clearTimeout(hideTimerRef.current);
      setError(errorInfo);
      hideTimerRef.current = setTimeout(() => setError(null), AUTO_HIDE_MS);
    });

    return () => {
      unsubscribe();
      clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (error) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [error]);

  if (!error) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.errorCard}
        onPress={hideError}
        activeOpacity={0.9}
      >
        <View style={styles.content}>
          {error.icon && <Text style={styles.icon}>{error.icon}</Text>}
          <View style={styles.textContainer}>
            <Text style={styles.title}>{error.title}</Text>
            <Text style={styles.message}>{error.message}</Text>
          </View>
          <TouchableOpacity onPress={hideError} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 9999,
  },
  errorCard: {
    backgroundColor: Colors.purpleMid,
    borderRadius: 15,
    padding: 20,
    borderWidth: 3,
    borderColor: Colors.redSoft,
    shadowColor: Colors.redSoft,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: Colors.lavender,
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 20,
    color: Colors.lavender,
    fontWeight: '700',
  },
});