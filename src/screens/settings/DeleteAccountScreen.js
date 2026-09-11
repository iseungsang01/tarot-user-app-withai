import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../../components/common/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveTitleHeader, ScreenContainer, SettingDeleteAccount } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { CommonStyles } from '../../styles/CommonStyles';
import { customerService } from '../../services/customerService';
import { createValidationError, handleApiCall, showErrorAlert } from '../../utils/errorHandler';

import { dialog } from '../../utils/dialog';
const DeleteAccountScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { customer, logout } = useAuth();
  const [processing, setProcessing] = useState(false);

  const handleDeleteAccount = async (password) => {
    if (!password) {
      showErrorAlert(createValidationError('PASSWORD_EMPTY'));
      return;
    }

    let keepProcessingForConfirmation = false;
    setProcessing(true);
    try {
            keepProcessingForConfirmation = true;
      // 익명화가 들어가면서(마이그레이션 20260912100000) 탈퇴의 실질 결과가 달라졌다.
      // 번호가 지워져 재가입해도 스탬프·쿠폰이 이어지지 않는다 — 스탬프를 모아 둔
      // 회원에게는 이게 "되돌릴 수 없습니다"보다 중요한 정보다.
      dialog.alert(
        '회원 탈퇴',
        '탈퇴하면 닉네임과 생일이 삭제되고 휴대폰번호는 알아볼 수 없게 바뀝니다.\n\n같은 번호로 다시 가입할 수는 있지만, 지금까지 모은 스탬프와 쿠폰은 새 계정으로 이어지지 않습니다.\n\n정말 탈퇴하시겠습니까?',
        [
          { text: '취소', style: 'cancel', onPress: () => setProcessing(false) },
          {
            text: '탈퇴',
            style: 'destructive',
            onPress: async () => {
              const { error } = await handleApiCall(
                'DeleteAccountScreen.delete',
                () => customerService.deleteCustomer(customer.id, password),
                { silentErrorCodes: ['invalid_password'] },
              );
              if (error) {
                setProcessing(false);
                dialog.alert('탈퇴 실패', error.message || '회원 탈퇴 처리 중 문제가 발생했습니다.');
                return;
              }
              await logout();
            },
          },
        ],
      );
    } finally {
      if (!keepProcessingForConfirmation) setProcessing(false);
    }
  };

  return (
    <ScreenContainer safeTop={false} safeBottom={false}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ArchiveTitleHeader eyebrow="Danger Zone" title="DELETE" subtitle="회원 탈퇴" style={styles.header} />

        <SettingDeleteAccount onDelete={handleDeleteAccount} processing={processing} />

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

export default DeleteAccountScreen;
