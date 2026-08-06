import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { CustomButton } from '../common/CustomButton';
import { styles } from '../../styles/SettingsStyles';

export const SettingDeleteAccount = ({ onDelete, processing }) => {
  const [password, setPassword] = useState('');

  return (
    <View style={styles.formCardDanger}>
      <TextInput
        style={styles.inputDanger}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="비밀번호를 입력하세요"
        placeholderTextColor="rgba(166, 137, 102, 0.55)"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
      />
      <CustomButton
        title="회원 탈퇴"
        onPress={() => onDelete(password)}
        variant="danger"
        loading={processing}
        style={{ marginTop: 10 }}
      />
    </View>
  );
};
