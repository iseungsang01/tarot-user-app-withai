import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground, CustomButton } from '../../components';
import { DrawerTheme } from '../../constants/DrawerTheme';

const guides = [
    {
        icon: '🧭',
        title: '하단 네비게이션 한눈에 보기',
        description: '홈(서랍 기록), 운세(오늘의 운세), 공지(새 소식), 투표(의견 참여), 설정(계정/앱 관리) 순서로 이동해요.',
    },
    {
        icon: '🏠',
        title: '홈 상단 버튼 설명',
        description: 'ON/OFF/ALL 버튼으로 상담/개인/전체 서랍을 전환하고, 보유 쿠폰 숫자를 누르면 쿠폰 화면으로 바로 이동해요.',
    },
    {
        icon: '🗂️',
        title: '홈 필터 버튼 설명',
        description: '전체/연도별/월별 버튼으로 기록을 좁혀볼 수 있고, 서랍을 길게 누르면 여러 개를 선택해 한 번에 삭제할 수 있어요.',
    },
    {
        icon: '➕',
        title: '개인 메모 서랍 추가',
        description: '홈 화면의 "+ 개인 메모 서랍 추가" 버튼을 누르면 직접 작성하는 서랍을 즉시 만들 수 있어요.',
    },
    {
        icon: '🔁',
        title: '가이드를 다시 보는 방법',
        description: '설정 화면의 "앱 사용 가이드 다시 보기" 버튼으로 언제든 같은 안내를 다시 확인할 수 있어요.',
    },
];

const OnboardingScreen = ({ onClose, buttonLabel = '시작하기' }) => {
    return (
        <GradientBackground>
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.title}>처음 오셨군요 ✨</Text>
                    <Text style={styles.subtitle}>타로 기록장을 더 쉽게 쓰기 위한 핵심 흐름을 먼저 안내드릴게요.</Text>

                    {guides.map((guide) => (
                        <View key={guide.title} style={styles.card}>
                            <Text style={styles.cardIcon}>{guide.icon}</Text>
                            <View style={styles.cardBody}>
                                <Text style={styles.cardTitle}>{guide.title}</Text>
                                <Text style={styles.cardDescription}>{guide.description}</Text>
                            </View>
                        </View>
                    ))}

                    <CustomButton title={buttonLabel} onPress={onClose} style={styles.button} />
                </ScrollView>
            </SafeAreaView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { padding: 22, paddingBottom: 50 },
    title: { fontSize: 28, color: DrawerTheme.goldBright, fontWeight: 'bold', marginBottom: 6 },
    subtitle: { color: DrawerTheme.woodLight, marginBottom: 20, lineHeight: 20 },
    card: {
        flexDirection: 'row',
        gap: 12,
        padding: 14,
        marginBottom: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.28)',
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    cardIcon: { fontSize: 24 },
    cardBody: { flex: 1 },
    cardTitle: { color: '#fff', fontWeight: '700', marginBottom: 4 },
    cardDescription: { color: DrawerTheme.woodLight, lineHeight: 19, fontSize: 13 },
    button: { marginTop: 8 },
});

export default OnboardingScreen;
