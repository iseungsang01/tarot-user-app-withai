import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveTitleHeader, GoldActionButton, PremiumCard, ScreenContainer } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { formatPhoneNumber } from '../../utils/formatters';
import { getPasswordValidationMessage, validatePassword, validatePhoneNumber } from '../../utils/validators';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { createValidationError } from '../../utils/errorHandler';

const RegisterScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [message, setMessage] = useState({ text: '', type: '' });
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();

    const resetMsg = () => message.text && setMessage({ text: '', type: '' });
    const handleTextChange = (setter) => (text) => {
        setter(text);
        resetMsg();
    };

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

        if (!validatePassword(password)) {
            setMessage({ text: getPasswordValidationMessage(), type: 'error' });
            return;
        }

        if (password !== confirmPassword) {
            setMessage({ text: '비밀번호가 일치하지 않습니다.', type: 'error' });
            return;
        }

        setLoading(true);
        setMessage({ text: '가입 정보를 처리하고 있습니다...', type: 'info' });

        try {
            const { data, error } = await register(phone, password, nickname);

            if (!data) {
                setMessage({ text: error?.message || '회원가입에 실패했습니다.', type: 'error' });
                setLoading(false); // 성공 시에는 AuthContext가 MainNavigator로 전환하므로 해제하지 않는다
            }
        } catch (error) {
            console.error('Register Error:', error);
            setMessage({ text: '오류가 발생했습니다. 다시 시도해주세요.', type: 'error' });
            setLoading(false);
        }
    };

    return (
        <ScreenContainer safeTop={false} safeBottom={false}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]}
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <ArchiveTitleHeader
                        eyebrow="Member Drawer"
                        title="JOIN"
                        subtitle="새로운 기록의 시작을 함께하세요"
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
                                <Text style={styles.inputLabel}>NICKNAME (선택)</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={nickname}
                                    onChangeText={handleTextChange(setNickname)}
                                    placeholder="사용하실 이름"
                                    placeholderTextColor="rgba(244, 232, 208, 0.62)"
                                    editable={!loading}
                                />
                            </View>

                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>PASSWORD</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={password}
                                    onChangeText={handleTextChange(setPassword)}
                                    placeholder="비밀번호 입력"
                                    placeholderTextColor="rgba(244, 232, 208, 0.62)"
                                    secureTextEntry
                                    editable={!loading}
                                />
                            </View>

                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>PASSWORD 확인</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={confirmPassword}
                                    onChangeText={handleTextChange(setConfirmPassword)}
                                    placeholder="비밀번호 다시 입력"
                                    placeholderTextColor="rgba(244, 232, 208, 0.62)"
                                    secureTextEntry
                                    editable={!loading}
                                    onSubmitEditing={handleRegister}
                                />
                            </View>
                        </View>

                        <GoldActionButton
                            onPress={handleRegister}
                            disabled={loading}
                            style={styles.registerButtonWrapper}
                        >
                            {loading ? '처리 중...' : '회원가입 완료'}
                        </GoldActionButton>

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
                    </PremiumCard>

                    <View style={styles.footerArea}>
                        <View style={styles.titleLine} />
                        <Text style={styles.footerHelp}>
                            입력하신 번호가 아이디가 됩니다.{"\n"}매장에 등록된 번호로 가입해 주세요.
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
        padding: 24,
        paddingBottom: 40,
    },
    headerArea: {
        marginBottom: 16,
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
        color: DrawerTheme.brightGold,
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
    registerButtonWrapper: {
        marginTop: 10,
    },
    backButtonWrapper: {
        marginTop: 15,
        alignItems: 'center',
        padding: 10,
    },
    backButtonText: {
        color: DrawerTheme.mutedIvory,
        fontSize: 13,
        fontWeight: '600',
        opacity: 0.86,
    },
    statusMsg: { padding: 12, borderRadius: 8, marginTop: 20, borderWidth: 1 },
    statusError: { backgroundColor: 'rgba(96, 21, 34, 0.28)', borderColor: 'rgba(164, 64, 76, 0.5)' },
    statusSuccess: { backgroundColor: 'rgba(76, 95, 52, 0.12)', borderColor: 'rgba(160, 150, 86, 0.38)' },
    statusInfo: { backgroundColor: 'rgba(200, 163, 64, 0.08)', borderColor: 'rgba(200, 163, 64, 0.3)' },
    statusText: { textAlign: 'center', fontSize: 13, color: DrawerTheme.textMain, fontWeight: '600' },
    footerArea: { alignItems: 'center', marginTop: 30 },
    titleLine: { width: 24, height: 1, backgroundColor: DrawerTheme.antiqueGold, marginBottom: 15, opacity: 0.72 },
    footerHelp: {
        fontSize: 12,
        color: DrawerTheme.textMuted,
        textAlign: 'center',
        lineHeight: 18,
        opacity: 0.96,
    },
});

export default RegisterScreen;
