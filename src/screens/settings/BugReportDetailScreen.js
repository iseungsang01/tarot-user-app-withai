import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveTitleHeader, ScreenContainer } from '../../components';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { toDisplayImageUri } from '../../utils/imageUri';
import ResponsiveImage from '../../components/common/ResponsiveImage';

const BugReportDetailScreen = ({ route }) => {
    const insets = useSafeAreaInsets();
    const { report } = route.params || {};

    if (!report) {
        return <ScreenContainer><View style={styles.emptyWrap}><Text style={styles.empty}>상세 정보를 찾을 수 없습니다.</Text></View></ScreenContainer>;
    }

    const imageUri = toDisplayImageUri(report.screenshot || report.image_base64 || report.image_url || null);

    return (
        <ScreenContainer safeTop={false} safeBottom={false}>
            <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 30 }]}>
                <ArchiveTitleHeader
                    eyebrow="Bug Report"
                    title="REPORT DETAIL"
                    subtitle="버그 접수 상세 내역"
                    style={styles.header}
                />
                <View style={styles.card}>
                    <Text style={styles.titleText}>{report.title}</Text>
                    <Text style={styles.meta}>상태: {report.status}</Text>
                    <Text style={styles.meta}>접수일: {new Date(report.created_at).toLocaleString()}</Text>
                    <Text style={styles.desc}>{report.description}</Text>
                    <ResponsiveImage uri={imageUri} style={styles.image} />
                </View>
            </ScrollView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    container: { paddingHorizontal: 20 },
    header: { marginBottom: 16 },
    card: { backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', borderRadius: 14, padding: 18 },
    titleText: { color: '#fff', fontWeight: '800', fontSize: 20, marginBottom: 12 },
    meta: { color: DrawerTheme.woodLight, marginBottom: 6 },
    desc: { color: '#ddd', lineHeight: 24, marginTop: 8 },
    image: { marginTop: 14, borderRadius: 10 },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { color: '#fff' }
});

export default BugReportDetailScreen;
