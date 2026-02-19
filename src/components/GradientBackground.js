import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gradients } from '../constants/Colors';

/**
 * 그라데이션 배경 컴포넌트
 * 앱 전체에서 일관된 보라색 그라데이션 배경 제공
 * 
 * @param {React.ReactNode} children - 배경 위에 렌더링할 컴포넌트
 * @param {string[]} colors - 그라데이션 색상 배열 (기본: Gradients.purple)
 * @param {object} style - 추가 스타일
 */
export const GradientBackground = ({ children, colors, style }) => {
  return (
    <LinearGradient
      colors={colors || Gradients.purple}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, style]}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});