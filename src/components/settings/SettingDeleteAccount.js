import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { CustomButton } from './CustomButton';
import { styles } from '../styles/SettingsStyles';

export const SettingDeleteAccount = ({ onDelete, processing }) => {
  const [password, setPassword] = useState('');

  return (
    <View style={styles.formCardDanger}>
      <Text style={styles.dangerText}>
        탈퇴 시 모든 데이터(스탬프/쿠폰)가 복구 불가능하게 삭제됩니다.
      </Text>
      <TextInput 
        style={styles.inputDanger} 
        value={password} 
        onChangeText={setPassword} 
        secureTextEntry 
        placeholder="비밀번호를 입력하세요" 
        placeholderTextColor="rgba(166, 137, 102, 0.5)" 
      />
      <CustomButton 
        title="회원 탈퇴" 
        onPress={() => onDelete(password)} 
        variant="danger" 
        loading={processing} 
        style={{marginTop: 10}} 
      />
    </View>
  );
};