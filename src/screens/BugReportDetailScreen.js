import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground } from '../components';
import { CommonStyles } from '../styles/CommonStyles';
import { DrawerTheme } from '../constants/DrawerTheme';
import { toDisplayImageUri } from '../utils/imageUri';

const BugReportDetailScreen = ({ route }) => {
  const insets = useSafeAreaInsets();
  const { report } = route.params || {};

  if (!report) {
    return <GradientBackground><View style={styles.emptyWrap}><Text style={styles.empty}>상세 정보를 찾을 수 없습니다.</Text></View></GradientBackground>;
  }

  const imageUri = toDisplayImageUri(report.screenshot || report.image_base64 || report.image_url || null);

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }]}>
        <View style={styles.header}>
          <View style={styles.titleRow}><Text style={styles.title}>BUG REPORT DETAIL</Text></View>
          <View style={styles.headerDivider} />
          <Text style={styles.subtitle}>접수한 버그의 상세 내용을 확인하세요</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.titleText}>{report.title}</Text>
          <Text style={styles.meta}>상태: {report.status}</Text>
          <Text style={styles.meta}>접수일: {new Date(report.created_at).toLocaleString()}</Text>
          <Text style={styles.desc}>{report.description}</Text>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}
        </View>
      </ScrollView>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20 },
  header: CommonStyles.headerBoard,
  titleRow: CommonStyles.titleRow,
  title: CommonStyles.title,
  headerDivider: CommonStyles.headerDivider,
  subtitle: CommonStyles.subtitle,
  card: { backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', borderRadius: 14, padding: 18 },
  titleText: { color: '#fff', fontWeight: '800', fontSize: 20, marginBottom: 12 },
  meta: { color: DrawerTheme.woodLight, marginBottom: 6 },
  desc: { color: '#ddd', lineHeight: 24, marginTop: 8 },
  image: { width: '100%', height: 220, marginTop: 14, borderRadius: 10 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#fff' }
});

export default BugReportDetailScreen;
