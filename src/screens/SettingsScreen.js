import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, StatusBar, Keyboard } from 'react-native';
import * as Device from 'expo-device';

// 통합 컴포넌트 임포트
import {
  GradientBackground,
  CustomButton,
  SettingPasswordForm,
  SettingReportManager,
  SettingDeleteAccount
} from '../components';

import { useAuth } from '../hooks/useAuth';
import { customerService } from '../services/customerService';
import { noticeService } from '../services/noticeService';
import { supabase } from '../services/supabase';
import { DrawerTheme } from '../constants/DrawerTheme';
import { APP_INFO } from '../constants/Config';
import {
  handleApiCall,
  createValidationError,
  showErrorAlert,
  showSuccessAlert
} from '../utils/errorHandler';
import { styles } from '../styles/SettingsStyles';

const getStatusColor = (s) => ({
  접수: '#ffa500', 확인중: '#2196f3', 완료: '#4caf50'
}[s] || DrawerTheme.woodLight);

const SettingsScreen = ({ navigation }) => {
  const { customer, logout } = useAuth();
  const [activeSection, setActiveSection] = useState(null);
  const [myReports, setMyReports] = useState([]);
  const [processing, setProcessing] = useState(false);

  // 데이터 로드 최적화
  const loadMyReports = useCallback(async () => {
    if (!customer?.id) return;
    const { data, error } = await handleApiCall(
      'SettingsScreen.loadMyReports',
      () => noticeService.getMyReports(customer.id),
      { showAlert: false }
    );
    if (!error && data) setMyReports(data);
  }, [customer?.id]);

  useEffect(() => {
    if (activeSection === 'report') loadMyReports();
  }, [activeSection, loadMyReports]);

  const toggleSection = useCallback((section) => {
    setActiveSection(prev => (prev === section ? null : section));
    Keyboard.dismiss();
  }, []);

  const getDeviceInfo = async () => {
    try {
      return {
        model: Device.modelName || 'Unknown',
        brand: Device.brand || 'Unknown',
        os: `${Device.osName} ${Device.osVersion}`,
        platform: Platform.OS,
        appVersion: APP_INFO.version,
      };
    } catch {
      return { platform: Platform.OS, appVersion: APP_INFO.version };
    }
  };

  // API 핸들러
  const handleSubmitReport = async (reportData) => {
    if (!reportData.title.trim() || !reportData.description.trim()) {
      showErrorAlert({ ...createValidationError('REQUIRED_FIELD'), message: '내용을 모두 입력해주세요.' }, Alert);
      return;
    }
    setProcessing(true);
    const deviceInfo = await getDeviceInfo();
    const { error } = await handleApiCall(
      'SettingsScreen.handleSubmitReport',
      () => noticeService.submitReport({ ...reportData, customer_id: customer.id, device_info: deviceInfo }),
      { showAlert: true }
    );
    if (!error) {
      Alert.alert('완료', '✅ 소중한 의견이 접수되었습니다.');
      loadMyReports();
    }
    setProcessing(false);
  };

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
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.titleRow}><Text style={styles.title}>SETTINGS</Text></View>
          <View style={styles.headerDivider} />
          <Text style={styles.subtitle}>{customer?.nickname}님 계정 설정을 관리하세요</Text>
        </View>

        {/* 내 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📱 내 정보</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>닉네임</Text><Text style={styles.infoValue}>{customer?.nickname}</Text></View>
            <View style={styles.divider} />
            <View style={styles.infoRow}><Text style={styles.infoLabel}>연락처</Text><Text style={styles.infoValue}>{customer?.isGuest ? '게스트' : customer?.phone_number}</Text></View>
          </View>
        </View>

        {/* 멤버십 서비스 (SAAS 지향) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💎 프리미엄 서비스</Text>
          <TouchableOpacity
            style={[styles.infoCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
            onPress={() => navigation.navigate('Membership')}
          >
            <View>
              <Text style={[styles.infoLabel, { color: DrawerTheme.goldBright, marginBottom: 4 }]}>현재 멤버십 플랜</Text>
              <Text style={[styles.infoValue, { fontSize: 18, fontWeight: '800' }]}>{customer?.membership_type || 'Free'} Plan</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>관리</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 설정 메뉴 (게스트는 숨김) */}
        {!customer?.isGuest && (
          <>
            <View style={styles.section}>
              <TouchableOpacity style={styles.menuButton} onPress={() => toggleSection('password')}>
                <Text style={styles.menuButtonText}>🔐 비밀번호 재설정 {activeSection === 'password' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {activeSection === 'password' && <SettingPasswordForm onSubmit={handlePasswordReset} processing={processing} />}
            </View>

            <View style={styles.section}>
              <TouchableOpacity style={styles.menuButton} onPress={() => toggleSection('report')}>
                <Text style={styles.menuButtonText}>🛠️ 버그 및 불편사항 관리 {activeSection === 'report' ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {activeSection === 'report' && <SettingReportManager myReports={myReports} onSubmit={handleSubmitReport} getStatusColor={getStatusColor} processing={processing} />}
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