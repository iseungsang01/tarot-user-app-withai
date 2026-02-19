import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useError } from '../context/ErrorContext';
import { Colors } from '../constants/Colors';

/**
 * 전역 에러 표시 컴포넌트
 * 화면 상단에 에러 토스트 메시지 표시
 */
export const GlobalErrorDisplay = () => {
  const { error, hideError } = useError();
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (error) {
      // 에러 표시: 위에서 아래로 슬라이드
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // 에러 숨김: 아래에서 위로 슬라이드
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