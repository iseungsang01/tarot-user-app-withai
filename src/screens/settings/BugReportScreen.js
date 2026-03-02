import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground, SettingReportManager } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { noticeService } from '../../services/noticeService';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { CommonStyles } from '../../styles/CommonStyles';

const getStatusColor = (s) => ({ 접수: '#ffa500', 확인중: '#2196f3', 완료: '#4caf50' }[s] || DrawerTheme.woodLight);

const BugReportScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { customer } = useAuth();
    const [myReports, setMyReports] = useState([]);
    const [processing, setProcessing] = useState(false);

    const loadMyReports = useCallback(async () => {
        if (!customer?.id) return;
        const { data } = await noticeService.getMyReports(customer.id);
        setMyReports(data || []);
    }, [customer?.id]);

    useEffect(() => { loadMyReports(); }, [loadMyReports]);

    const handleSubmitReport = async (reportData) => {
        if (!reportData.title.trim() || !reportData.description.trim()) {
            Alert.alert('안내', '제목과 내용을 입력해주세요.');
            return;
        }
        setProcessing(true);
        const { error } = await noticeService.submitReport({ ...reportData, customer_id: customer.id, report_type: '어플 버그' });
        if (!error) {
            Alert.alert('완료', '버그가 접수되었습니다.');
            loadMyReports();
        }
        setProcessing(false);
    };

    return (
        <GradientBackground>
            <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }]}>
                <View style={styles.header}>
                    <View style={styles.titleRow}><Text style={styles.title}>BUG REPORT</Text></View>
                    <View style={styles.headerDivider} />
                    <Text style={styles.subtitle}>앱 오류를 자세히 접수하고 진행 상태를 확인하세요</Text>
                </View>
                <SettingReportManager myReports={myReports} onSubmit={handleSubmitReport} getStatusColor={getStatusColor} processing={processing} onOpenDetail={(report) => navigation.navigate('BugReportDetail', { report })} />
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
});

export default BugReportScreen;
