import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Keyboard } from 'react-native';

import {
  GradientBackground,
  CustomButton,
  SettingPasswordForm,
  SettingDeleteAccount
} from '../components';

import { useAuth } from '../hooks/useAuth';
import { customerService } from '../services/customerService';
import { supabase } from '../services/supabase';
import {
  handleApiCall,
  createValidationError,
  showErrorAlert,
  showSuccessAlert
} from '../utils/errorHandler';
import { APP_INFO } from '../constants/Config';
import { styles } from '../styles/SettingsStyles';

const SettingsScreen = ({ navigation }) => {
  const { customer, logout } = useAuth();
  const [activeSection, setActiveSection] = useState(null);
  const [processing, setProcessing] = useState(false);

  const toggleSection = useCallback((section) => {
    setActiveSection(prev => (prev === section ? null : section));
    Keyboard.dismiss();
  }, []);

  const handlePasswordReset = async ({ currentPassword, newPassword, confirmPassword }) => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showErrorAlert({ ...createValidationError('REQUIRED_FIELD'), message: '필드를 채워주세요.' }, Alert);
      return;
    }
    setProcessing(true);
    try {
      const { data: isValid } = await supabase.rpc('verify_password', {
        customer_uuid: customer.id,
        input_password: currentPassword
      });
      if (!isValid) {
        Alert.alert('오류', '현재 비밀번호가 일치하지 않습니다.');
        return;
      }
      const { error } = await supabase.rpc('update_customer_password', {
        customer_uuid: customer.id,
        new_password: newPassword
      });
      if (!error) {
        showSuccessAlert('UPDATE', Alert, '비밀번호가 변경되었습니다.');
        setActiveSection(null);
      }
    } finally { setProcessing(false); }
  };

  const handleDeleteAccount = async (password) => {
    if (!password) {
      showErrorAlert(createValidationError('PASSWORD_EMPTY'), Alert);
      return;
    }
    setProcessing(true);
    try {
      const { data: isValid } = await supabase.rpc('verify_password', {
        customer_uuid: customer.id,
        input_password: password
      });
      if (!isValid) {
        Alert.alert('오류', '비밀번호가 일치하지 않습니다.');
        setProcessing(false);
        return;
      }
      Alert.alert('회원 탈퇴', '정말 탈퇴하시겠습니까?', [
        { text: '취소', onPress: () => setProcessing(false) },
        {
          text: '탈퇴', style: 'destructive', onPress: async () => {
            const { error } = await handleApiCall('SettingsScreen.delete', () => customerService.deleteCustomer(customer.id));
            if (!error) await logout();
          }
        }
      ]);
    } catch { setProcessing(false); }
  };

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.titleRow}><Text style={styles.title}>SETTINGS</Text></View>
          <View style={styles.headerDivider} />
          <Text style={styles.subtitle}>{customer?.nickname}님 계정 설정을 관리하세요</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📱 내 정보</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>닉네임</Text><Text style={styles.infoValue}>{customer?.nickname}</Text></View>
            <View style={styles.divider} />
            <View style={styles.infoRow}><Text style={styles.infoLabel}>연락처</Text><Text style={styles.infoValue}>{customer?.isGuest ? '게스트' : customer?.phone_number}</Text></View>
          </View>
        </View>

        {!customer?.isGuest && (
          <>
            <View style={styles.section}>
              <TouchableOpacity style={styles.menuButton} onPress={() => toggleSection('password')}>
                <Text style={styles.menuButtonText}>🔐 비밀번호 재설정 {activeSection === 'password' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {activeSection === 'password' && <SettingPasswordForm onSubmit={handlePasswordReset} processing={processing} />}
            </View>

            <View style={styles.section}>
              <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('BugReport')}>
                <Text style={styles.menuButtonText}>🛠️ 앱 버그 접수/내역 보기</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <TouchableOpacity style={styles.menuButtonDanger} onPress={() => toggleSection('delete')}>
                <Text style={styles.menuButtonTextDanger}>🗑️ 회원 탈퇴 {activeSection === 'delete' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {activeSection === 'delete' && <SettingDeleteAccount onDelete={handleDeleteAccount} processing={processing} />}
            </View>
          </>
        )}

        <CustomButton
          title="로그아웃"
          onPress={() => Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [{ text: '취소' }, { text: '로그아웃', onPress: logout }])}
          variant="secondary"
        />
        <View style={styles.appInfo}><Text style={styles.appInfoText}>Tarot Stamp v{APP_INFO.version}</Text></View>
      </ScrollView>
    </GradientBackground>
  );
};

export default SettingsScreen;
