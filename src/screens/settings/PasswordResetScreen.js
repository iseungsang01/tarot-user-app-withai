import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveTitleHeader, ScreenContainer, SettingPasswordForm } from '../../components';
import { customerService } from '../../services/customerService';
import { createValidationError, showErrorAlert, showSuccessAlert } from '../../utils/errorHandler';
import { getPasswordValidationMessage, validatePassword } from '../../utils/validators';

const PasswordResetScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [processing, setProcessing] = useState(false);

  const handlePasswordReset = async ({ currentPassword, newPassword, confirmPassword }) => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showErrorAlert({ ...createValidationError('REQUIRED_FIELD'), message: '모든 필드를 입력해 주세요.' }, Alert);
      return;
    }

    if (!validatePassword(newPassword)) {
      Alert.alert('오류', getPasswordValidationMessage());
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('오류', '새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setProcessing(true);
    try {
      const { success, error } = await customerService.updateMyPassword(
        currentPassword,
        newPassword,
        'settings_change',
      );

      if (error || !success) {
        console.error('Update password error:', error);
        Alert.alert('\uC624\uB958', error?.message || '\uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.');
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
