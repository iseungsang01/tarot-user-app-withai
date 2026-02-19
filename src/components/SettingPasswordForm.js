import React, { useState, useCallback } from 'react';
import { View, TextInput } from 'react-native';
import { CustomButton } from './CustomButton';
import { styles } from '../styles/SettingsStyles';

export const SettingPasswordForm = ({ onSubmit, processing }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handlePress = useCallback(() => {
    onSubmit({ currentPassword, newPassword, confirmPassword });
  }, [currentPassword, newPassword, confirmPassword, onSubmit]);

  return (
    <View style={styles.formCard}>
      <TextInput 
        style={styles.input} 
        value={currentPassword} 
        onChangeText={setCurrentPassword} 
        secureTextEntry 
        placeholder="현재 비밀번호" 
        placeholderTextColor="rgba(166, 137, 102, 0.5)" 
      />
      <TextInput 
        style={[styles.input, {marginTop: 10}]} 
        value={newPassword} 
        onChangeText={setNewPassword} 
        secureTextEntry 
        placeholder="새 비밀번호" 
        placeholderTextColor="rgba(166, 137, 102, 0.5)" 
      />
      <TextInput 
        style={[styles.input, {marginTop: 10}]} 
        value={confirmPassword} 
        onChangeText={setConfirmPassword} 
        secureTextEntry 
        placeholder="새 비밀번호 확인" 
        placeholderTextColor="rgba(166, 137, 102, 0.5)" 
      />
      <CustomButton 
        title="비밀번호 변경" 
        onPress={handlePress} 
        loading={processing} 
        style={{marginTop: 15}} 
      />
    </View>
  );
};