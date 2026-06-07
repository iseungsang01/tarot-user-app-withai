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
  style,
  textStyle,
  numberOfLines,
  allowFontScaling,
  ellipsizeMode,
  accessibilityLabel,
  accessibilityRole = 'button',
}) => {
  const VARIANT_TOKENS = {
    primary: {
      gradient: Gradients.button,
      borderColor: Colors.gold,
      borderWidth: 2,
      textWeight: '800',
    },
    secondary: {
      gradient: ['rgba(138, 43, 226, 0.18)', 'rgba(138, 43, 226, 0.32)'],
      borderColor: 'rgba(204, 153, 255, 0.72)',
      borderWidth: 1,
      textWeight: '600',
    },
    danger: {
      gradient: Gradients.red,
      borderColor: Colors.redSoft,
      borderWidth: 2,
      textWeight: '700',
    },
  };

  const tokens = VARIANT_TOKENS[variant] || VARIANT_TOKENS.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={style}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
    >
      <LinearGradient
        colors={tokens.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.button,
          { borderColor: tokens.borderColor, borderWidth: tokens.borderWidth },
          disabled && styles.disabled
        ]}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text
            style={[styles.text, { fontWeight: tokens.textWeight }, textStyle]}
            numberOfLines={numberOfLines}
            allowFontScaling={allowFontScaling}
            ellipsizeMode={ellipsizeMode}
          >
            {title}
          </Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});
