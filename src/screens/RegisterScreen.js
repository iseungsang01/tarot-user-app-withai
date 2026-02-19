import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientBackground } from '../components';
import { useAuth } from '../hooks/useAuth';
import { formatPhoneNumber } from '../utils/formatters';
import { validatePhoneNumber } from '../utils/validators';
import { DrawerTheme } from '../constants/DrawerTheme';
import { Gradients } from '../constants/Colors';
import { createValidationError } from '../utils/errorHandler';

const RegisterScreen = ({ navigation }) => {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [message, setMessage] = useState({ text: '', type: '' });
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();

    const resetMsg = () => message.text && setMessage({ text: '', type: '' });

    const handlePhoneChange = (text) => {
        setPhone(formatPhoneNumber(text));
        resetMsg();
    };

    const handleRegister = async () => {
        if (!validatePhoneNumber(phone)) {
            const errorInfo = createValidationError('PHONE_INVALID');
            setMessage({ text: errorInfo.message, type: 'error' });
            return;
        }

        if (!password.trim()) {
            setMessage({ text: '비밀번호를 입력해주세요.', type: 'error' });
            return;
        }

        if (password !== confirmPassword) {
            setMessage({ text: '비밀번호가 일치하지 않습니다.', type: 'error' });
            return;
        }

        setLoading(true);
        setMessage({ text: '가입 정보를 처리하고 있습니다...', type: 'info' });

        try {
            // AuthContext/service에 register 기능이 있다고 가정하거나 추가할 예정
            const { data, error } = await register(phone, password, nickname);

            if (data) {
                Alert.alert('가입 완료', '회원가입이 완료되었습니다. 로그인해주세요.', [
                    { text: '확인', onPress: () => navigation.navigate('Login') }
                ]);
            } else {
                setMessage({ text: error?.message || '회원가입에 실패했습니다.', type: 'error' });
            }
        } catch (error) {
            console.error('Register Error:', error);
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

                    <View style={styles.headerArea}>
                        <Text style={styles.mainTitle}>MEMBERSHIP JOIN</Text>
                        <View style={styles.headerDivider} />
                        <Text style={styles.mainSubtitle}>새로운 기록의 시작을 함께하세요</Text>
                    </View>

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
                                <Text style={styles.inputLabel}>닉네임 (선택)</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={nickname}
                                    onChangeText={(text) => { setNickname(text); resetMsg(); }}
                                    placeholder="사용하실 이름을 입력하세요"
                                    placeholderTextColor="rgba(166, 137, 102, 0.4)"
                                    editable={!loading}
                                />
                            </View>

                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>비밀번호</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={password}
                                    onChangeText={(text) => { setPassword(text); resetMsg(); }}
                                    placeholder="비밀번호 입력"
                                    placeholderTextColor="rgba(166, 137, 102, 0.4)"
                                    secureTextEntry
                                    editable={!loading}
                                />
                            </View>

                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>비밀번호 확인</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={confirmPassword}
                                    onChangeText={(text) => { setConfirmPassword(text); resetMsg(); }}
                                    placeholder="비밀번호 다시 입력"
                                    placeholderTextColor="rgba(166, 137, 102, 0.4)"
                                    secureTextEntry
                                    editable={!loading}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={handleRegister}
                            disabled={loading}
                            activeOpacity={0.8}
                            style={styles.registerButtonWrapper}
                        >
                            <LinearGradient
                                colors={Gradients.goldBrown}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.registerButton, loading && styles.registerButtonDisabled]}
                            >
                                <Text style={styles.registerButtonText}>
                                    {loading ? '처리 중...' : '회원가입 완료'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            disabled={loading}
                            activeOpacity={0.7}
                            style={styles.backButtonWrapper}
                        >
                            <Text style={styles.backButtonText}>이미 계정이 있으신가요? 로그인</Text>
                        </TouchableOpacity>

                        {message.text && (
                            <View style={[styles.statusMsg, styles[`status${message.type.charAt(0).toUpperCase() + message.type.slice(1)}`]]}>
                                <Text style={styles.statusText}>{message.text}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.footerArea}>
                        <View style={styles.titleLine} />
                        <Text style={styles.footerHelp}>
                            가입 시 입력하신 번호가 아이디가 됩니다.{"\n"}비밀번호는 소중히 관리해주시기 바랍니다.
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
    registerButtonWrapper: {
        marginTop: 10,
    },
    registerButton: {
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
    registerButtonDisabled: {
        opacity: 0.5,
    },
    registerButtonText: {
        color: '#1A0F0A',
        fontSize: 17,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    backButtonWrapper: {
        marginTop: 15,
        alignItems: 'center',
        padding: 10,
    },
    backButtonText: {
        color: DrawerTheme.woodLight,
        fontSize: 14,
        textDecorationLine: 'underline',
        opacity: 0.8,
    },
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

export default RegisterScreen;
