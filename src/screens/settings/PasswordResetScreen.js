import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveTitleHeader, ScreenContainer, SettingPasswordForm } from '../../components';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { createValidationError, showErrorAlert, showSuccessAlert } from '../../utils/errorHandler';

const PasswordResetScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { customer } = useAuth();
  const [processing, setProcessing] = useState(false);

  const handlePasswordReset = async ({ currentPassword, newPassword, confirmPassword }) => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showErrorAlert({ ...createValidationError('REQUIRED_FIELD'), message: '모든 필드를 입력해 주세요.' }, Alert);
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('오류', '비밀번호는 6자 이상이어야합니다');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('오류', '새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setProcessing(true);
    try {
      const { data: isValid, error: verifyError } = await supabase.rpc('verify_password', {
        customer_uuid: customer.id,
        input_password: currentPassword,
      });

      if (verifyError) {
        console.error('Verify password error:', verifyError);
        Alert.alert('오류', '비밀번호 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      if (!isValid) {
        Alert.alert('오류', '현재 비밀번호가 일치하지 않습니다.');
        return;
      }

      const { data: changed, error } = await supabase.rpc('update_customer_password', {
        customer_uuid: customer.id,
        new_password: newPassword,
        p_reason: 'settings_change',
      });

      if (error || !changed) {
        console.error('Update password error:', error);
        Alert.alert('오류', '비밀번호 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      showSuccessAlert('UPDATE', Alert, '비밀번호가 변경되었습니다.');
      navigation.goBack();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ScreenContainer safeTop={false} safeBottom={false}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ArchiveTitleHeader eyebrow="Account Security" title="PASSWORD" subtitle="비밀번호 재설정" style={styles.header} />

        <SettingPasswordForm onSubmit={handlePasswordReset} processing={processing} />

        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          disabled={processing}
          activeOpacity={0.75}
          style={[styles.backButton, processing && styles.disabled]}
        >
          <Text style={styles.backText}>설정으로 돌아가기</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 16,
  },
  backButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  disabled: {
    opacity: 0.45,
  },
  backText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default PasswordResetScreen;
