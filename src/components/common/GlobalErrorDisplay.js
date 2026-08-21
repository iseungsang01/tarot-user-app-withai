import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { errorEmitter } from '../../utils/errorEmitter';
import { DrawerTheme } from '../../constants/DrawerTheme';

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
  const insets = useSafeAreaInsets();
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
        { top: insets.top + 12 },
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity
        onPress={hideError}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="알림 닫기"
      >
        <LinearGradient
          colors={[DrawerTheme.bgDeepPurple, DrawerTheme.bgBlackCherry]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.errorCard}
        >
          <View style={styles.brassLip} />
          <View style={styles.content}>
            {error.icon && <Text style={styles.icon}>{error.icon}</Text>}
            <View style={styles.textContainer}>
              <Text style={styles.title}>{error.title}</Text>
              <Text style={styles.message}>{error.message}</Text>
            </View>
            <Text style={styles.closeButtonText}>✕</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  errorCard: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: DrawerTheme.archiveBorderStrong,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  brassLip: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 2,
    opacity: 0.7,
    backgroundColor: DrawerTheme.brassHighlight,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: DrawerTheme.brightGold,
    marginBottom: 3,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    color: DrawerTheme.ivory,
    opacity: 0.9,
  },
  closeButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: DrawerTheme.mutedIvory,
    paddingHorizontal: 4,
  },
});
