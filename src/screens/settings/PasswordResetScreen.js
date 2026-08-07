import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveTitleHeader, ScreenContainer, SettingPasswordForm } from '../../components';
import { CommonStyles } from '../../styles/CommonStyles';
import { customerService } from '../../services/customerService';
import { showSuccessAlert } from '../../utils/errorHandler';
import { validatePasswordChange } from '../../utils/validators';

import { dialog } from '../../utils/dialog';
const PasswordResetScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [processing, setProcessing] = useState(false);

  const handlePasswordReset = async (fields) => {
    const inputError = validatePasswordChange(fields);
    if (inputError) {
      dialog.alert('오류', inputError);
      return;
    }

    const { currentPassword, newPassword } = fields;
    setProcessing(true);
    try {
      const { success, error } = await customerService.updateMyPassword(
        currentPassword,
        newPassword,
        'settings_change',
      );

      if (error || !success) {
        dialog.alert('오류', error?.message || '비밀번호 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      showSuccessAlert('UPDATE', '비밀번호가 변경되었습니다.');
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
          style={[CommonStyles.backLinkButton, processing && CommonStyles.disabled]}
        >
          <Text style={CommonStyles.backLinkText}>설정으로 돌아가기</Text>
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
});

export default PasswordResetScreen;
