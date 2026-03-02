import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground, CustomButton } from '../../components';
import { DrawerTheme } from '../../constants/DrawerTheme';

const guideSteps = [
    {
        key: 'tab-home',
        title: '하단 탭: 홈',
        description: '홈 탭에서 서랍 기록과 스탬프/쿠폰 현황을 가장 먼저 확인할 수 있어요.',
        highlightGroup: 'tab',
        highlightItem: '홈'
    },
    {
        key: 'tab-fortune',
        title: '하단 탭: 운세',
        description: '운세 탭은 오늘의 운세를 확인할 때 사용해요.',
        highlightGroup: 'tab',
        highlightItem: '운세'
    },
    {
        key: 'tab-notice',
        title: '하단 탭: 공지',
        description: '공지 탭에서 새 소식과 운영 공지를 빠르게 볼 수 있어요.',
        highlightGroup: 'tab',
        highlightItem: '공지'
    },
    {
        key: 'tab-vote',
        title: '하단 탭: 투표',
        description: '투표 탭에서 다른 사용자들과 의견을 나눌 수 있어요.',
        highlightGroup: 'tab',
        highlightItem: '투표'
    },
    {
        key: 'tab-settings',
        title: '하단 탭: 설정',
        description: '설정 탭에서 계정 관리와 앱 사용 가이드를 다시 볼 수 있어요.',
        highlightGroup: 'tab',
        highlightItem: '설정'
    },
    {
        key: 'mode-on',
        title: '홈 상단: ON',
        description: 'ON은 상담 기록 서랍만 모아 보여줍니다.',
        highlightGroup: 'mode',
        highlightItem: 'ON'
    },
    {
        key: 'mode-off',
        title: '홈 상단: OFF',
        description: 'OFF는 개인 메모 서랍만 따로 확인할 수 있어요.',
        highlightGroup: 'mode',
        highlightItem: 'OFF'
    },
    {
        key: 'mode-all',
        title: '홈 상단: ALL',
        description: 'ALL은 상담/개인 메모를 함께 볼 때 사용합니다.',
        highlightGroup: 'mode',
        highlightItem: 'ALL'
    },
    {
        key: 'coupon',
        title: '홈 상단: 쿠폰',
        description: '보유 쿠폰 영역을 누르면 쿠폰함으로 바로 이동해요.',
        highlightGroup: 'mode',
        highlightItem: '쿠폰'
    },
    {
        key: 'filter',
        title: '홈 필터 버튼',
        description: '전체/연도별/월별 필터로 원하는 기간만 빠르게 볼 수 있어요.',
        highlightGroup: 'filter',
        highlightItem: '연도별'
    },
    {
        key: 'manual-drawer',
        title: '개인 메모 서랍 추가',
        description: '"+ 개인 메모 서랍 추가" 버튼으로 즉시 새 서랍을 만들 수 있어요.',
        highlightGroup: 'manual',
        highlightItem: '개인 메모 서랍 추가'
    },
];

const OnboardingScreen = ({ onClose, buttonLabel = '시작하기' }) => {
    const [stepIndex, setStepIndex] = useState(0);
    const currentStep = guideSteps[stepIndex];

    const buttonOpacity = useMemo(() => (group, item) => {
        if (currentStep.highlightGroup !== group) {
            return 0.3;
        }
        return currentStep.highlightItem === item ? 1 : 0.28;
    }, [currentStep]);

    const isLastStep = stepIndex === guideSteps.length - 1;

    return (
        <GradientBackground>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeText}>✕</Text>
                    </TouchableOpacity>

                    <Text style={styles.title}>앱 사용 가이드</Text>
                    <Text style={styles.subtitle}>밝아진 버튼이 현재 설명 중인 기능입니다.</Text>

                    <View style={styles.mockPanel}>
                        <Text style={styles.sectionTitle}>하단 탭</Text>
                        <View style={styles.row}>
                            {['홈', '운세', '공지', '투표', '설정'].map((tab) => (
                                <View key={tab} style={[styles.mockButton, { opacity: buttonOpacity('tab', tab) }]}>
                                    <Text style={styles.mockText}>{tab}</Text>
                                </View>
                            ))}
                        </View>

                        <Text style={styles.sectionTitle}>홈 상단 버튼</Text>
                        <View style={styles.row}>
                            {['ON', 'OFF', 'ALL', '쿠폰'].map((item) => (
                                <View key={item} style={[styles.mockButton, { opacity: buttonOpacity('mode', item) }]}>
                                    <Text style={styles.mockText}>{item}</Text>
                                </View>
                            ))}
                        </View>

                        <Text style={styles.sectionTitle}>홈 필터</Text>
                        <View style={styles.row}>
                            {['전체', '연도별', '월별'].map((item) => (
                                <View key={item} style={[styles.mockButton, { opacity: buttonOpacity('filter', item) }]}>
                                    <Text style={styles.mockText}>{item}</Text>
                                </View>
                            ))}
                        </View>

                        <Text style={styles.sectionTitle}>하단 서랍</Text>
                        <View style={[styles.manualDrawer, { opacity: buttonOpacity('manual', '개인 메모 서랍 추가') }]}>
                            <Text style={styles.manualDrawerText}>+ 개인 메모 서랍 추가</Text>
                        </View>
                    </View>

                    <View style={styles.descCard}>
                        <Text style={styles.stepCounter}>{stepIndex + 1} / {guideSteps.length}</Text>
                        <Text style={styles.stepTitle}>{currentStep.title}</Text>
                        <Text style={styles.stepDescription}>{currentStep.description}</Text>
                    </View>

                    <View style={styles.bottomButtons}>
                        <CustomButton
                            title="이전"
                            onPress={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                            style={styles.navButton}
                            textStyle={styles.navButtonText}
                        />
                        <CustomButton
                            title={isLastStep ? buttonLabel : '다음'}
                            onPress={() => {
                                if (isLastStep) {
                                    onClose();
                                    return;
                                }
                                setStepIndex((prev) => Math.min(guideSteps.length - 1, prev + 1));
                            }}
                            style={styles.navButton}
                            textStyle={styles.navButtonText}
                        />
                    </View>
                </View>
            </SafeAreaView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1, padding: 20 },
    closeButton: {
        position: 'absolute',
        top: 18,
        right: 18,
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: DrawerTheme.goldBrass,
        backgroundColor: 'rgba(7,11,20,0.86)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    closeText: { color: DrawerTheme.goldBright, fontWeight: '700', fontSize: 18 },
    title: { fontSize: 24, color: DrawerTheme.goldBright, fontWeight: 'bold', marginTop: 22 },
    subtitle: { color: DrawerTheme.woodLight, marginTop: 6, marginBottom: 14 },
    mockPanel: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.28)',
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.24)',
    },
    sectionTitle: { color: DrawerTheme.goldBrass, marginTop: 8, marginBottom: 6, fontWeight: '700' },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    mockButton: {
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: DrawerTheme.woodFrame,
        backgroundColor: DrawerTheme.navyMid,
    },
    mockText: { color: '#fff', fontWeight: '600', fontSize: 12 },
    manualDrawer: {
        borderRadius: 10,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: DrawerTheme.goldBrass,
        paddingVertical: 16,
        paddingHorizontal: 10,
        marginTop: 2,
        backgroundColor: DrawerTheme.navyDark,
    },
    manualDrawerText: { color: DrawerTheme.goldBrass, fontWeight: '700', textAlign: 'center' },
    descCard: {
        marginTop: 14,
        borderRadius: 12,
        padding: 14,
        backgroundColor: 'rgba(11,16,30,0.82)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.24)',
    },
    stepCounter: { color: DrawerTheme.goldBrass, fontSize: 12, marginBottom: 4 },
    stepTitle: { color: '#fff', fontWeight: '700', marginBottom: 6 },
    stepDescription: { color: DrawerTheme.woodLight, lineHeight: 19 },
    bottomButtons: { flexDirection: 'row', gap: 10, marginTop: 14 },
    navButton: { flex: 1, paddingVertical: 12 },
    navButtonText: { fontSize: 14 },
});

export default OnboardingScreen;
