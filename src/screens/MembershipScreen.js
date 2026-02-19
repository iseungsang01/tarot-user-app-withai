/**
 * src/screens/MembershipScreen.js
 * 프리미엄 멤버십 구독 화면 (SaaS 구조)
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground } from '../components';
import { DrawerTheme } from '../constants/DrawerTheme';

const PricingCard = ({ title, price, period, features, isPopular, onSubscribe, color }) => (
    <View style={[styles.card, isPopular && styles.popularCard]}>
        {isPopular && (
            <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
            </View>
        )}
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.priceRow}>
            <Text style={styles.priceText}>{price}</Text>
            <Text style={styles.periodText}>{period}</Text>
        </View>
        <View style={styles.featuresList}>
            {features.map((f, i) => (
                <View key={i} style={styles.featureItem}>
                    <Text style={styles.featureIcon}>✓</Text>
                    <Text style={styles.featureText}>{f}</Text>
                </View>
            ))}
        </View>
        <TouchableOpacity
            style={[styles.subscribeBtn, { backgroundColor: color || DrawerTheme.goldBright }]}
            onPress={onSubscribe}
        >
            <Text style={[styles.subscribeBtnText, { color: color === '#FFF' ? '#000' : '#000' }]}>
                {title === 'Free' ? '현재 사용 중' : '지금 구독하기'}
            </Text>
        </TouchableOpacity>
    </View>
);

const MembershipScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();

    const handleBack = () => navigation.goBack();

    return (
        <GradientBackground>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* 헤더 */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                        <Text style={styles.backBtnText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>멤버십 플랜</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.heroSection}>
                        <Text style={styles.heroEmoji}>💎</Text>
                        <Text style={styles.heroTitle}>더 깊은 통찰력을 얻으세요</Text>
                        <Text style={styles.heroSubtitle}>무제한 AI 상담과 독점적인 타로 가이드를 제공합니다.</Text>
                    </View>

                    <PricingCard
                        title="Free"
                        price="₩0"
                        period="/ 평생"
                        features={[
                            '월 100회 AI 상담',
                            '기본 운세 분석',
                            '방문 기록 저장',
                        ]}
                        color="rgba(255,255,255,0.2)"
                    />

                    <PricingCard
                        title="Pro"
                        price="₩4,900"
                        period="/ 월"
                        isPopular={true}
                        features={[
                            '일일 운세 제공',
                            '일일 10회 AI 상담',
                            '광고 없는 쾌적한 환경',
                            '우선 순위 AI 응답',
                        ]}
                        color={DrawerTheme.goldBright}
                    />

                    <PricingCard
                        title="Premium"
                        price="₩9,900"
                        period="/ 월"
                        features={[
                            '일일 운세 제공',
                            '일일 50회 AI 상담',
                            'Pro의 모든 기능 포함',
                            '월별 AI 리포트 제공',
                        ]}
                        color="#A06AF9"
                    />

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            구독은 언제든지 취소할 수 있습니다.{"\n"}
                            결제 시 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
                        </Text>
                    </View>
                </ScrollView>
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backBtnText: { color: '#FFF', fontSize: 20, fontWeight: '300' },
    headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },

    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    heroSection: {
        alignItems: 'center',
        marginVertical: 30,
    },
    heroEmoji: { fontSize: 50, marginBottom: 15 },
    heroTitle: {
        color: '#FFF',
        fontSize: 26,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },

    // 카드
    card: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 24,
        padding: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        position: 'relative',
    },
    popularCard: {
        borderColor: DrawerTheme.goldBright,
        borderWidth: 2,
        backgroundColor: 'rgba(255,215,0,0.05)',
    },
    popularBadge: {
        position: 'absolute',
        top: -12,
        alignSelf: 'center',
        backgroundColor: DrawerTheme.goldBright,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    popularBadgeText: {
        color: '#000',
        fontSize: 10,
        fontWeight: '900',
    },
    cardTitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 24,
    },
    priceText: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: '800',
    },
    periodText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 16,
        marginBottom: 6,
        marginLeft: 4,
    },
    featuresList: {
        marginBottom: 24,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 10,
    },
    featureIcon: {
        color: DrawerTheme.goldBright,
        fontSize: 16,
        fontWeight: 'bold',
    },
    featureText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
    },
    subscribeBtn: {
        height: 54,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    subscribeBtnText: {
        fontSize: 16,
        fontWeight: '800',
    },

    footer: {
        marginTop: 20,
        alignItems: 'center',
    },
    footerText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 16,
    },
});

export default MembershipScreen;
