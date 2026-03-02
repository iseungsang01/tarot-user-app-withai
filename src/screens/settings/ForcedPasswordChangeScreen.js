import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SettingPasswordForm, GradientBackground } from '../../components';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';

const ForcedPasswordChangeScreen = ({ navigation }) => {
  const { customer, refreshCustomer } = useAuth();
  const [processing, setProcessing] = useState(false);

  const handlePasswordReset = async ({ currentPassword, newPassword, confirmPassword }) => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('입력 필요', '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('입력 오류', '새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setProcessing(true);
    try {
      const { data: isValid, error: verifyError } = await supabase.rpc('verify_password', {
        customer_uuid: customer.id,
        input_password: currentPassword,
      });

      if (verifyError || !isValid) {
        Alert.alert('오류', '현재 비밀번호가 일치하지 않습니다.');
        return;
      }

      const { data: changed, error } = await supabase.rpc('update_customer_password', {
        customer_uuid: customer.id,
        new_password: newPassword,
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
        <SettingPasswordForm onSubmit={handlePasswordReset} processing={processing} />
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
});

export default ForcedPasswordChangeScreen;
