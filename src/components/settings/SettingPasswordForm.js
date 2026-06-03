import React, { useCallback, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { CustomButton } from '../common/CustomButton';
import { styles } from '../../styles/SettingsStyles';

export const SettingPasswordForm = ({ onSubmit, processing, requireCurrentPassword = true }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handlePress = useCallback(() => {
    onSubmit({ currentPassword, newPassword, confirmPassword });
  }, [currentPassword, newPassword, confirmPassword, onSubmit]);

  return (
    <View style={styles.formCard}>
      <Text style={styles.innerTitle}>새 비밀번호를 입력해 주세요</Text>
      {requireCurrentPassword && (
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          placeholder="현재 비밀번호"
          placeholderTextColor="rgba(166, 137, 102, 0.55)"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
        />
      )}
      <TextInput
        style={[styles.input, requireCurrentPassword && { marginTop: 10 }]}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        placeholder="새 비밀번호"
        placeholderTextColor="rgba(166, 137, 102, 0.55)"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
      />
      <TextInput
        style={[styles.input, { marginTop: 10 }]}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        placeholder="새 비밀번호 확인"
        placeholderTextColor="rgba(166, 137, 102, 0.55)"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
      />
      <CustomButton
        title="비밀번호 변경"
        onPress={handlePress}
        loading={processing}
        style={{ marginTop: 15 }}
      />
    </View>
  );
};
