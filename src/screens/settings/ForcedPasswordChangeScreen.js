import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SettingPasswordForm, GradientBackground } from '../../components';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { normalizeCustomerPassword } from '../../utils/password';

const ForcedPasswordChangeScreen = ({ navigation }) => {
  const { customer, refreshCustomer, logout } = useAuth();
  const [processing, setProcessing] = useState(false);

  const handlePasswordReset = async ({ newPassword, confirmPassword }) => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('입력 필요', '새 비밀번호를 입력해주세요.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('입력 오류', '새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setProcessing(true);
    try {
      const { data: changed, error } = await supabase.rpc('update_customer_password', {
        customer_uuid: customer.id,
        new_password: normalizeCustomerPassword(newPassword),
        p_reason: 'forced_change',
      });

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
    <GradientBackground>
      <View style={styles.container}>
        <Text style={styles.title}>비밀번호 변경이 필요합니다</Text>
        <Text style={styles.description}>초기/임시 비밀번호 계정은 로그인 후 반드시 새 비밀번호로 변경해야 합니다.</Text>
        <SettingPasswordForm onSubmit={handlePasswordReset} processing={processing} requireCurrentPassword={false} />
        <TouchableOpacity
          accessibilityRole="button"
          onPress={logout}
          disabled={processing}
          activeOpacity={0.75}
          style={[styles.cancelButton, processing && styles.cancelButtonDisabled]}
        >
          <Text style={styles.cancelText}>취소하고 로그인 화면으로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
  },
  description: {
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: 16,
  },
  cancelButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelButtonDisabled: {
    opacity: 0.45,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default ForcedPasswordChangeScreen;
