import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

/**
 * 로딩 스피너 컴포넌트
 * 데이터 로딩 중 표시
 * 
 * @param {string} message - 로딩 메시지 (기본: '로딩 중...')
 * @param {string} size - 스피너 크기 ('small' | 'large')
 */
export const LoadingSpinner = ({ message = '로딩 중...', size = 'large' }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={Colors.gold} />
      {message && <Text style={styles.text}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    color: Colors.lavender,
    fontSize: 16,
    marginTop: 10,
  },
});