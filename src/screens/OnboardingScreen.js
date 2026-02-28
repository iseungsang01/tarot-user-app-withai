import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground } from '../components/GradientBackground';
import { CustomButton } from '../components/CustomButton';
import { DrawerTheme } from '../constants/DrawerTheme';

const guides = [
  {
    icon: '🏠',
    title: '홈에서 기록 관리',
    description: '상담/개인 메모 서랍을 무제한으로 만들고, 서랍별 요약/썸네일을 빠르게 확인할 수 있어요.',
  },
  {
    icon: '🎟️',
    title: '쿠폰은 홈에서 바로 이동',
    description: '스탬프 진행률(10개 기준)과 쿠폰 보유 수를 홈 상단에서 확인하고 바로 쿠폰 화면으로 이동해요.',
  },
  {
    icon: '📢',
    title: '공지와 투표는 하단 네비게이션',
    description: 'AI 상담 탭 대신 공지/투표를 분리해 필요한 소식을 빠르게 확인할 수 있어요.',
  },
  {
    icon: '🎙️',
    title: '음성 메모로 기록 보조',
    description: '상담 상세 화면에서 녹음 기능으로 빠르게 메모를 남길 수 있도록 준비했어요.',
  },
];

const OnboardingScreen = ({ onClose }) => {
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

          <CustomButton title="시작하기" onPress={onClose} style={styles.button} />
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
