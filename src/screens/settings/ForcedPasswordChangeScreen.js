import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveTitleHeader, PremiumCard, ScreenContainer, SettingPasswordForm } from '../../components';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CommonStyles } from '../../styles/CommonStyles';
import { customerService } from '../../services/customerService';
import { useAuth } from '../../hooks/useAuth';
import { validatePasswordChange } from '../../utils/validators';

const ForcedPasswordChangeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { refreshCustomer, logout } = useAuth();
  const [processing, setProcessing] = useState(false);

  const handlePasswordReset = async (fields) => {
    const inputError = validatePasswordChange(fields);
    if (inputError) {
      Alert.alert('오류', inputError);
      return;
    }

    const { currentPassword, newPassword } = fields;
    setProcessing(true);
    try {
      const { success: changed, error } = await customerService.updateMyPassword(
        currentPassword,
        newPassword,
        'forced_change',
      );

      if (error || !changed) {
        Alert.alert('변경 실패', error?.message || '비밀번호 변경에 실패했습니다.');
        return;
      }

      await refreshCustomer();
      Alert.alert('완료', '비밀번호가 변경되었습니다.');
      navigation.replace('MainTabs');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ScreenContainer safeTop={false} safeBottom={false}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 30 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ArchiveTitleHeader
          eyebrow="Password Reset"
          title="PASSWORD RESET"
          subtitle="비밀번호 재설정"
          style={styles.header}
        />

        <PremiumCard variant="walnut" style={styles.noticeCard}>
          <Text style={styles.title}>비밀번호 변경이 필요합니다</Text>
          <Text style={styles.description}>초기/임시 비밀번호 계정은 로그인 후 반드시 새 비밀번호로 변경해야 합니다.</Text>
        </PremiumCard>

        <View style={styles.formWrap}>
          <SettingPasswordForm onSubmit={handlePasswordReset} processing={processing} requireCurrentPassword />
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={logout}
          disabled={processing}
          activeOpacity={0.75}
          style={[CommonStyles.backLinkButton, processing && CommonStyles.disabled]}
        >
          <Text style={CommonStyles.backLinkText}>취소하고 로그인 화면으로 돌아가기</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  header: { marginBottom: 16 },
  noticeCard: { marginBottom: 14 },
  formWrap: { marginTop: 2 },
  title: {
    color: DrawerTheme.goldBright,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
  },
  description: {
    color: DrawerTheme.ivory,
    lineHeight: 21,
  },
});

export default ForcedPasswordChangeScreen;
