import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveTitleHeader, ScreenContainer, SettingDeleteAccount } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { CommonStyles } from '../../styles/CommonStyles';
import { customerService } from '../../services/customerService';
import { createValidationError, handleApiCall, showErrorAlert } from '../../utils/errorHandler';

const DeleteAccountScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { customer, logout } = useAuth();
  const [processing, setProcessing] = useState(false);

  const handleDeleteAccount = async (password) => {
    if (!password) {
      showErrorAlert(createValidationError('PASSWORD_EMPTY'), Alert);
      return;
    }

    let keepProcessingForConfirmation = false;
    setProcessing(true);
    try {
            keepProcessingForConfirmation = true;
      Alert.alert('회원 탈퇴', '정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.', [
        { text: '취소', style: 'cancel', onPress: () => setProcessing(false) },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: async () => {
            const { error } = await handleApiCall('DeleteAccountScreen.delete', () => customerService.deleteCustomer(customer.id, password));
            if (error) {
              setProcessing(false);
              return;
            }
            await logout();
          },
        },
      ]);
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
