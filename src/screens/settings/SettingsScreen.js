import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Keyboard, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    CellarMark,
    GoldActionButton,
    PremiumCard,
    PremiumHeaderPanel,
    ScreenContainer,
    SettingPasswordForm,
    SettingDeleteAccount
} from '../../components';

import { useAuth } from '../../hooks/useAuth';
import { useUI } from '../../context/UIContext';
import { customerService } from '../../services/customerService';
import { supabase } from '../../services/supabase';
import {
    handleApiCall,
    createValidationError,
    showErrorAlert,
    showSuccessAlert
} from '../../utils/errorHandler';
import { APP_INFO } from '../../constants/Config';
import { DrawerTheme } from '../../constants/DrawerTheme';

const MENU_ITEMS = {
    info: '내 정보',
    guide: '앱 이용 가이드 다시보기',
    password: '비밀번호 재설정',
    reports: '앱 버그 접수/내역 보기',
    delete: '회원 탈퇴',
};

const SettingsScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { customer, logout } = useAuth();
    const { triggerCoachMarks } = useUI();
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
        if (newPassword !== confirmPassword) {
            Alert.alert('오류', '새 비밀번호 확인이 일치하지 않습니다.');
            return;
        }
        setProcessing(true);
        try {
            const { data: isValid, error: verifyError } = await supabase.rpc('verify_password', {
                customer_uuid: customer.id,
                input_password: currentPassword
            });
            if (verifyError) {
                console.error('Verify password error:', verifyError);
                Alert.alert('오류', '비밀번호 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                return;
            }
            if (!isValid) {
                Alert.alert('오류', '현재 비밀번호가 일치하지 않습니다.');
                return;
            }
            const { error } = await supabase.rpc('update_customer_password', {
                customer_uuid: customer.id,
                new_password: newPassword,
                p_reason: 'settings_change'
            });
            if (error) {
                console.error('Update password error:', error);
                Alert.alert('오류', '비밀번호 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                return;
            }
            showSuccessAlert('UPDATE', Alert, '비밀번호가 변경되었습니다.');
            setActiveSection(null);
        } finally { setProcessing(false); }
    };

    const handleDeleteAccount = async (password) => {
        if (!password) {
            showErrorAlert(createValidationError('PASSWORD_EMPTY'), Alert);
            return;
        }
        setProcessing(true);
        try {
            const { data: isValid, error: verifyError } = await supabase.rpc('verify_password', {
                customer_uuid: customer.id,
                input_password: password
            });
            if (verifyError) {
                console.error('Verify password error:', verifyError);
                Alert.alert('오류', '비밀번호 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                setProcessing(false);
                return;
            }
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
        <ScreenContainer safeTop={false} safeBottom={false}>
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 108 }
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <PremiumHeaderPanel title="SETTINGS" subtitle={`${customer?.nickname || 'Guest'}님의 계정과 앱 설정을 관리하세요`} compact />

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{MENU_ITEMS.info}</Text>
                    <PremiumCard style={styles.infoCard}>
                        <View style={styles.infoRow}><Text style={styles.infoLabel}>닉네임</Text><Text style={styles.infoValue}>{customer?.nickname}</Text></View>
                        <View style={styles.divider} />
                        <View style={styles.infoRow}><Text style={styles.infoLabel}>연락처</Text><Text style={styles.infoValue}>{customer?.isGuest ? '게스트' : customer?.phone_number}</Text></View>
                    </PremiumCard>
                </View>

                <View style={styles.section}>
                    <MenuRow
                        label={MENU_ITEMS.guide}
                        onPress={() => {
                            navigation.navigate('Home');
                            navigation.getParent()?.navigate('Home');
                            triggerCoachMarks();
                        }}
                    />
                </View>

                {!customer?.isGuest && (
                    <>
                        <View style={styles.section}>
                            <MenuRow label={MENU_ITEMS.password} onPress={() => toggleSection('password')} open={activeSection === 'password'} />
                            {activeSection === 'password' && <SettingPasswordForm onSubmit={handlePasswordReset} processing={processing} />}
                        </View>

                        <View style={styles.section}>
                            <MenuRow label={MENU_ITEMS.reports} onPress={() => navigation.navigate('BugReport')} />
                        </View>

                        <View style={styles.section}>
                            <MenuRow label={MENU_ITEMS.delete} danger onPress={() => toggleSection('delete')} open={activeSection === 'delete'} />
                            {activeSection === 'delete' && <SettingDeleteAccount onDelete={handleDeleteAccount} processing={processing} />}
                        </View>
                    </>
                )}

                <GoldActionButton
                    title="LOG OUT"
                    onPress={() => Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [{ text: '취소' }, { text: '로그아웃', onPress: logout }])}
                    dark
                    style={styles.logoutButton}
                />
                <View style={styles.appInfo}><Text style={styles.appInfoText}>Tarot Stamp v{APP_INFO.version}</Text></View>
            </ScrollView>
        </ScreenContainer>
    );
};

const MenuRow = ({ label, onPress, danger = false, open = false }) => (
    <TouchableOpacity activeOpacity={0.84} onPress={onPress}>
        <PremiumCard style={[styles.menuCard, danger && styles.menuCardDanger]}>
            <View style={styles.menuContent}>
                <CellarMark size={18} filled={!danger} />
                <Text style={[styles.menuText, danger && styles.menuTextDanger]}>{label}</Text>
                <Text style={[styles.menuArrow, danger && styles.menuTextDanger]}>{open ? 'CLOSE' : 'OPEN'}</Text>
            </View>
        </PremiumCard>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    scrollContent: {
        padding: 20,
        paddingBottom: 100,
    },
    section: { marginTop: 14 },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: DrawerTheme.goldBrass,
        marginBottom: 8,
        marginLeft: 5,
        letterSpacing: 1.2,
    },
    infoCard: {
        padding: 15,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        gap: 12,
    },
    infoLabel: {
        color: DrawerTheme.mutedIvory,
        fontSize: 13,
    },
    infoValue: {
        color: DrawerTheme.ivory,
        fontWeight: '700',
        fontSize: 13,
        flexShrink: 1,
        textAlign: 'right',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(200,163,64,0.18)',
        marginVertical: 4,
    },
    menuCard: {
        padding: 0,
        marginBottom: 0,
    },
    menuCardDanger: {
        borderColor: 'rgba(128,45,58,0.72)',
    },
    menuContent: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        gap: 12,
    },
    menuText: {
        flex: 1,
        color: DrawerTheme.ivory,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    menuTextDanger: {
        color: '#C98286',
    },
    menuArrow: {
        color: DrawerTheme.mutedGold,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    logoutButton: {
        marginTop: 18,
    },
    appInfo: {
        marginTop: 34,
        alignItems: 'center',
    },
    appInfoText: {
        color: DrawerTheme.mutedGold,
        fontSize: 11,
        opacity: 0.75,
    },
});

export default SettingsScreen;
