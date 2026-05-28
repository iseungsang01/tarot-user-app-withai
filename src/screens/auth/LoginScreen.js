import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { GoldActionButton, PremiumCard, PremiumHeaderPanel, ScreenContainer } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { formatPhoneNumber } from '../../utils/formatters';
import { validatePhoneNumber } from '../../utils/validators';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { createValidationError } from '../../utils/errorHandler';

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
        setMessage({ text: '회원 정보를 확인하고 있습니다...', type: 'info' });

        try {
            const { data, error } = await login(phone, password);

            if (data) {
                if (data.must_change_password) {
                    setMessage({ text: '임시 비밀번호 계정입니다. 다음 화면에서 비밀번호 변경을 완료해주세요.', type: 'info' });
                } else {
                    setMessage({ text: '환영합니다.', type: 'success' });
                }
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
        <ScreenContainer safeTop={false} safeBottom={false}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
                    <PremiumHeaderPanel
                        title="TAROT CELLAR"
                        subtitle="보관된 상담 기록을 확인하려면 멤버십 입장을 완료하세요"
                        style={styles.headerArea}
                    />

                    <PremiumCard variant="walnut" style={styles.mainCard}>
                        <View style={styles.inputSection}>
                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>PHONE NUMBER</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={phone}
                                    onChangeText={handlePhoneChange}
                                    placeholder="010-0000-0000"
                                    placeholderTextColor="rgba(244, 232, 208, 0.62)"
                                    keyboardType="phone-pad"
                                    maxLength={13}
                                    editable={!loading}
                                />
                            </View>

                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>PASSWORD</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={password}
                                    onChangeText={handlePasswordChange}
                                    placeholder="********"
                                    placeholderTextColor="rgba(244, 232, 208, 0.62)"
                                    secureTextEntry
                                    editable={!loading}
                                    onSubmitEditing={handleLogin}
                                />
                            </View>
                        </View>

                        <GoldActionButton
                            onPress={handleLogin}
                            disabled={loading}
                            style={styles.loginButtonWrapper}
                        >
                            {loading ? '확인 중...' : 'LOGIN'}
                        </GoldActionButton>

                        <View style={styles.subButtonArea}>
                            <View style={styles.subButtonRow}>
                                <TouchableOpacity
                                    onPress={async () => {
                                        try {
                                            const { error } = await guestLogin();
                                            if (error) {
                                                setMessage({ text: '게스트 로그인 오류', type: 'error' });
                                            }
                                        } catch (e) {
                                            setMessage({ text: '게스트 로그인 중 오류가 발생했습니다.', type: 'error' });
                                        }
                                    }}
                                    disabled={loading}
                                    activeOpacity={0.7}
                                    style={styles.subButton}
                                >
                                    <Text style={styles.subButtonText}>게스트로 둘러보기</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.subButtonRow}>
                                <TouchableOpacity
                                    onPress={() => setMessage({ text: '비밀번호 재설정은 매장 문의를 통해 진행해주세요.', type: 'info' })}
                                    disabled={loading}
                                    activeOpacity={0.7}
                                    style={styles.subButton}
                                >
                                    <Text style={styles.subButtonText}>비밀번호를 잊으셨나요?</Text>
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
                        </View>

                        {message.text && (
                            <View style={[styles.statusMsg, styles[`status${message.type.charAt(0).toUpperCase() + message.type.slice(1)}`]]}>
                                <Text style={styles.statusText}>{message.text}</Text>
                            </View>
                        )}
                    </PremiumCard>

                    <View style={styles.footerArea}>
                        <View style={styles.titleLine} />
                        <Text style={styles.footerHelp}>
                            매장에 등록하신 번호로 이용 가능합니다.{"\n"}정보가 기억나지 않으면 매장에 문의해주세요.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenContainer>
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
        marginBottom: 24,
    },
    mainCard: {
        padding: 24,
        width: '100%',
    },
    inputSection: { marginBottom: 10 },
    inputWrapper: { marginBottom: 20 },
    inputLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: DrawerTheme.goldBright,
        marginBottom: 8,
        paddingLeft: 4,
        letterSpacing: 1.5,
    },
    textInput: {
        backgroundColor: 'rgba(7,0,9,0.72)',
        borderRadius: 10,
        padding: 16,
        fontSize: 16,
        color: DrawerTheme.ivory,
        textAlign: 'center',
        fontWeight: '600',
        borderWidth: 1,
        borderColor: 'rgba(184,135,53,0.52)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.28,
        shadowRadius: 4,
    },
    loginButtonWrapper: {
        marginTop: 10,
    },
    subButtonArea: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    subButtonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
    },
    subButton: {
        padding: 10,
    },
    subButtonText: {
        color: DrawerTheme.mutedIvory,
        fontSize: 13,
        opacity: 0.86,
        fontWeight: '600',
    },
    subButtonDivider: {
        width: 1,
        height: 12,
        backgroundColor: DrawerTheme.mutedGold,
        marginHorizontal: 8,
        opacity: 0.7,
    },
    statusMsg: { padding: 12, borderRadius: 8, marginTop: 20, borderWidth: 1 },
    statusError: { backgroundColor: 'rgba(96, 21, 34, 0.28)', borderColor: 'rgba(164, 64, 76, 0.5)' },
    statusSuccess: { backgroundColor: 'rgba(76, 95, 52, 0.12)', borderColor: 'rgba(160, 150, 86, 0.38)' },
    statusInfo: { backgroundColor: 'rgba(200, 163, 64, 0.08)', borderColor: 'rgba(200, 163, 64, 0.3)' },
    statusText: { textAlign: 'center', fontSize: 13, color: DrawerTheme.textMain, fontWeight: '600' },
    footerArea: { alignItems: 'center', marginTop: 30 },
    titleLine: { width: 24, height: 1, backgroundColor: DrawerTheme.goldBrass, marginBottom: 15, opacity: 0.72 },
    footerHelp: {
        fontSize: 12,
        color: DrawerTheme.textMuted,
        textAlign: 'center',
        lineHeight: 18,
        opacity: 0.96,
    },
});

export default LoginScreen;
