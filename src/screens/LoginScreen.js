import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientBackground } from '../components';
import { useAuth } from '../hooks/useAuth';
import { formatPhoneNumber } from '../utils/formatters';
import { validatePhoneNumber } from '../utils/validators';
import { DrawerTheme } from '../constants/DrawerTheme';
import { Gradients } from '../constants/Colors';
import { createValidationError } from '../utils/errorHandler';
import { ERROR_MESSAGES } from '../constants/ErrorMessages';

const LoginScreen = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  const { login, guestLogin } = useAuth();

  const resetMsg = () => message.text && setMessage({ text: '', type: '' });

  const handlePhoneChange = (text) => {
    setPhone(formatPhoneNumber(text));
    resetMsg();
  };

  const handlePasswordChange = (text) => {
    setPassword(text);
    resetMsg();
  };

  const handleLogin = async () => {
    if (!validatePhoneNumber(phone)) {
      const errorInfo = createValidationError('PHONE_INVALID');
      setMessage({ text: errorInfo.message, type: 'error' });
      return;
    }

    if (!password.trim()) {
      const errorInfo = createValidationError('PASSWORD_EMPTY');
      setMessage({ text: errorInfo.message, type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '정보를 확인하고 있습니다...', type: 'info' });

    try {
      const { data, error } = await login(phone, password);

      if (data) {
        setMessage({ text: '환영합니다!', type: 'success' });
      } else {
        setMessage({ text: error?.message || '로그인에 실패했습니다.', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: '오류가 발생했습니다. 다시 시도해주세요.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>

          {/* 상단 Antic 헤더 영역 */}
          <View style={styles.headerArea}>
            <Text style={styles.mainTitle}>MEMBERSHIP LOGIN</Text>
            <View style={styles.headerDivider} />
            <Text style={styles.mainSubtitle}>서랍장 속 소중한 기록을 확인하세요</Text>
          </View>

          {/* 메인 입력 카드 */}
          <View style={styles.mainCard}>
            <View style={styles.inputSection}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>전화번호</Text>
                <TextInput
                  style={styles.textInput}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  placeholder="010-0000-0000"
                  placeholderTextColor="rgba(166, 137, 102, 0.4)"
                  keyboardType="phone-pad"
                  maxLength={13}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>비밀번호</Text>
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={handlePasswordChange}
                  placeholder="********"
                  placeholderTextColor="rgba(166, 137, 102, 0.4)"
                  secureTextEntry
                  editable={!loading}
                  onSubmitEditing={handleLogin}
                />
              </View>
            </View>

            {/* ✅ 골드 브라운 커스텀 버튼 */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
              style={styles.loginButtonWrapper}
            >
              <LinearGradient
                colors={Gradients.goldBrown}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              >
                <Text style={styles.loginButtonText}>
                  {loading ? '확인 중...' : '로그인'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* ✅ 하단 보조 버튼 영역 (게스트 / 회원가입) */}
            <View style={styles.subButtonArea}>
              <TouchableOpacity
                onPress={async () => {
                  console.log('Guest Login Button Pressed');
                  try {
                    const { error } = await guestLogin();
                    if (error) {
                      setMessage({ text: '게스트 로그인 오류', type: 'error' });
                    }
                  } catch (e) {
                    console.error('Guest Login Error in UI:', e);
                  }
                }}
                disabled={loading}
                activeOpacity={0.7}
                style={styles.subButton}
              >
                <Text style={styles.subButtonText}>게스트로 둘러보기</Text>
              </TouchableOpacity>

              <View style={styles.subButtonDivider} />

              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                disabled={loading}
                activeOpacity={0.7}
                style={styles.subButton}
              >
                <Text style={styles.subButtonText}>회원가입</Text>
              </TouchableOpacity>
            </View>


            {/* 알림 메시지 디자인 */}
            {message.text && (
              <View style={[styles.statusMsg, styles[`status${message.type.charAt(0).toUpperCase() + message.type.slice(1)}`]]}>
                <Text style={styles.statusText}>{message.text}</Text>
              </View>
            )}
          </View>

          <View style={styles.footerArea}>
            <View style={styles.titleLine} />
            <Text style={styles.footerHelp}>
              매장에 등록하신 번호로 이용 가능합니다.{"\n"}정보가 기억나지 않으시면 가게에 문의해주세요.{"\n"}초기 비밀번호는 1234입니다.{"\n"}로그인 후 비밀번호를 변경해주세요.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },

  // 헤더 (NoticeScreen 스타일 계승)
  headerArea: {
    backgroundColor: DrawerTheme.woodDark,
    borderRadius: 12,
    paddingVertical: 30,
    paddingHorizontal: 20,
    marginBottom: 25,
    borderWidth: 1.5,
    borderColor: DrawerTheme.woodFrame,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: DrawerTheme.goldBrass,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Cochin' : 'serif'
  },
  headerDivider: {
    width: 40,
    height: 2,
    backgroundColor: DrawerTheme.goldBrass,
    marginVertical: 12,
    opacity: 0.7
  },
  mainSubtitle: {
    fontSize: 12,
    color: DrawerTheme.woodLight,
    opacity: 0.8,
    letterSpacing: 0.5
  },

  // 입력 카드 (HistoryScreen의 대시보드 스타일 계승)
  mainCard: {
    backgroundColor: '#2A1B12',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#5D4037',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15
  },

  inputSection: { marginBottom: 10 },
  inputWrapper: { marginBottom: 20 },
  inputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: DrawerTheme.goldBrass,
    marginBottom: 8,
    paddingLeft: 4,
    letterSpacing: 1.5
  },

  textInput: {
    backgroundColor: '#1A110B',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#E0C9A6',
    textAlign: 'center',
    fontWeight: '500',
    borderWidth: 1,
    borderColor: '#423229',
  },

  // ✅ 골드 브라운 버튼 스타일
  loginButtonWrapper: {
    marginTop: 10,
  },
  loginButton: {
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: DrawerTheme.goldBrass,
    shadowColor: DrawerTheme.goldBrass,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: '#1A0F0A',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 2,
  },

  // ✅ 하단 보조 버튼 스타일
  subButtonArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  subButton: {
    padding: 10,
  },
  subButtonText: {
    color: DrawerTheme.woodLight,
    fontSize: 14,
    textDecorationLine: 'underline',
    opacity: 0.8,
  },
  subButtonDivider: {
    width: 1,
    height: 12,
    backgroundColor: DrawerTheme.woodLight,
    marginHorizontal: 10,
    opacity: 0.3,
  },


  // 알림 메시지 디자인
  statusMsg: { padding: 12, borderRadius: 8, marginTop: 20, borderWidth: 1 },
  statusError: { backgroundColor: 'rgba(255, 82, 82, 0.05)', borderColor: 'rgba(255, 82, 82, 0.3)' },
  statusSuccess: { backgroundColor: 'rgba(76, 175, 80, 0.05)', borderColor: 'rgba(76, 175, 80, 0.3)' },
  statusInfo: { backgroundColor: 'rgba(212, 175, 55, 0.05)', borderColor: 'rgba(212, 175, 55, 0.3)' },
  statusText: { textAlign: 'center', fontSize: 13, color: DrawerTheme.woodLight, fontWeight: '500' },

  footerArea: { alignItems: 'center', marginTop: 30 },
  titleLine: { width: 20, height: 1, backgroundColor: DrawerTheme.woodFrame, marginBottom: 15 },
  footerHelp: {
    fontSize: 12,
    color: DrawerTheme.woodLight,
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.6
  },
});

export default LoginScreen;