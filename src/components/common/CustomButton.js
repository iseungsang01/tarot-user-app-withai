import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../../constants/Colors';

/**
 * 커스텀 버튼 컴포넌트
 * 앱 전체에서 일관된 버튼 디자인 제공
 * 
 * @param {string} title - 버튼 텍스트
 * @param {function} onPress - 클릭 이벤트 핸들러
 * @param {boolean} disabled - 비활성화 상태
 * @param {boolean} loading - 로딩 상태
 * @param {string} variant - 버튼 스타일 ('primary' | 'secondary' | 'danger')
 * @param {object} style - 추가 스타일
 */
export const CustomButton = ({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  size = 'default',
  style,
  textStyle
}) => {
  const variantTokens = {
    primary: {
      gradient: Gradients.button,
      borderColor: Colors.gold,
      borderWidth: 2,
      textWeight: '700',
    },
    secondary: {
      gradient: ['rgba(138, 43, 226, 0.22)', 'rgba(138, 43, 226, 0.34)'],
      borderColor: Colors.purpleLight,
      borderWidth: 1.5,
      textWeight: '600',
    },
    tertiary: {
      gradient: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.1)'],
      borderColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      textWeight: '500',
    },
    danger: {
      gradient: Gradients.red,
      borderColor: Colors.redSoft,
      borderWidth: 2,
      textWeight: '700',
    },
  };

  const sizeTokens = {
    default: {
      paddingVertical: 15,
      paddingHorizontal: 30,
      minHeight: 50,
      textSize: 16,
    },
    compact: {
      paddingVertical: 11,
      paddingHorizontal: 14,
      minHeight: 44,
      textSize: 13,
    },
  };

  const currentVariant = variantTokens[variant] || variantTokens.primary;
  const currentSize = sizeTokens[size] || sizeTokens.default;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={style}
    >
      <LinearGradient
        colors={currentVariant.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.button,
          {
            borderColor: currentVariant.borderColor,
            borderWidth: currentVariant.borderWidth,
            paddingVertical: currentSize.paddingVertical,
            paddingHorizontal: currentSize.paddingHorizontal,
            minHeight: currentSize.minHeight,
          },
          disabled && styles.disabled
        ]}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={[styles.text, { fontWeight: currentVariant.textWeight, fontSize: currentSize.textSize }, textStyle]}>{title}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: 'white',
  },
  disabled: {
    opacity: 0.5,
  },
});
