import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveTitleHeader, ScreenContainer, SettingReportManager } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { noticeService } from '../../services/noticeService';
import { buildDeviceInfo } from '../../utils/diagnostics';
import { DrawerTheme } from '../../constants/DrawerTheme';

import { dialog } from '../../utils/dialog';
// submit_bug_report 는 한도 초과를 success:false 가 아니라 오류로 던진다(매니저 7차).
// 시간당 5건 초과는 P0001, 크기 초과는 22023.
const getSubmitErrorMessage = (error) => {
    if (error?.code === 'P0001') return '버그 접수는 1시간에 5건까지 가능합니다. 잠시 후 다시 시도해주세요.';
    if (error?.code === '22023') return '내용이 너무 깁니다. 제목은 200자, 내용은 2000자 이내로 줄여주세요.';
    return '버그 접수에 실패했습니다. 잠시 후 다시 시도해주세요.';
};

const getStatusColor = (s) => ({ 접수: '#ffa500', 확인중: '#2196f3', 완료: '#4caf50' }[s] || DrawerTheme.mutedIvory);

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
            dialog.alert('안내', '제목과 내용을 입력해주세요.');
            return false;
        }
        setProcessing(true);
        // 기기·앱 버전과 최근 에러 로그를 같이 실어 보낸다. bug_reports.device_info 와
        // submit_bug_report 의 p_device_info 는 원래 있었는데 계속 null 이 들어가고
        // 있었다. 개인정보 처리방침 제1조 2항이 고지하는 "기기 정보"가 이것이다.
        const device_info = await buildDeviceInfo();
        const { error } = await noticeService.submitReport({ ...reportData, customer_id: customer.id, device_info });
        setProcessing(false);
        if (error) {
            dialog.alert('오류', getSubmitErrorMessage(error));
            return false;
        }
        dialog.alert('완료', '버그가 접수되었습니다.');
        loadMyReports();
        return true;
    };

    return (
        <ScreenContainer safeTop={false} safeBottom={false}>
            <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled">
                <ArchiveTitleHeader
                    eyebrow="Bug Report"
                    title="BUG REPORT"
                    subtitle="앱 버그 접수 내역"
                    style={styles.header}
                />
                <SettingReportManager myReports={myReports} onSubmit={handleSubmitReport} getStatusColor={getStatusColor} processing={processing} onOpenDetail={(report) => navigation.navigate('BugReportDetail', { report })} />
            </ScrollView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    container: { paddingHorizontal: 20 },
    header: { marginBottom: 16 },
});

export default BugReportScreen;
