import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CustomButton } from './CustomButton';
import { styles } from '../styles/SettingsStyles';
import { compressImage } from '../utils/imageOptimizer';

export const SettingReportManager = ({ myReports, onSubmit, getStatusColor, processing, onOpenDetail }) => {
  const [reportData, setReportData] = useState({
    title: '', description: '', report_type: '어플 버그', screenshot: null
  });

  const handleFieldChange = (field, value) => {
    setReportData(prev => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return;

    const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.7 });
    if (!res.canceled && res.assets?.[0]?.uri) {
      const comp = await compressImage(res.assets[0].uri, { maxWidth: 1000, quality: 0.6 });
      setReportData(prev => ({ ...prev, screenshot: comp.base64 }));
    }
  };

  const handleSubmit = async () => {
    await onSubmit(reportData);
    setReportData({ title: '', description: '', report_type: '어플 버그', screenshot: null });
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.innerTitle}>📝 앱 버그 접수</Text>
      <TextInput
        style={styles.input}
        value={reportData.title}
        onChangeText={(t) => handleFieldChange('title', t)}
        placeholder="제목"
        placeholderTextColor="rgba(166, 137, 102, 0.5)"
      />
      <TextInput
        style={[styles.input, styles.textArea]}
        value={reportData.description}
        onChangeText={(t) => handleFieldChange('description', t)}
        placeholder="버그 상황을 자세히 적어주세요"
        placeholderTextColor="rgba(166, 137, 102, 0.5)"
        multiline
      />

      <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
        <Text style={styles.uploadButtonText}>📎 스크린샷 첨부</Text>
      </TouchableOpacity>
      {!!reportData.screenshot && (
        <Image source={{ uri: `data:image/jpeg;base64,${reportData.screenshot}` }} style={styles.previewImage} />
      )}

      <CustomButton
        title="접수하기"
        onPress={handleSubmit}
        loading={processing}
        style={{ marginTop: 10 }}
      />

      <View style={styles.sectionDivider} />
      <Text style={styles.innerTitle}>📋 내 접수 내역 ({myReports.length})</Text>
      {myReports.length === 0 ? (
        <Text style={styles.emptyText}>접수 내역이 없습니다.</Text>
      ) : (
        myReports.map(item => (
          <TouchableOpacity key={item.id} style={styles.historyCard} activeOpacity={0.8} onPress={() => onOpenDetail?.(item)}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyType}>{item.report_type || '어플 버그'}</Text>
              <View style={[styles.statusBadge, { borderColor: getStatusColor(item.status) }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.historyDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
            <Text style={styles.detailText}>상세 보기 →</Text>

            {item.admin_response && item.admin_response.trim() !== '' && (
              <View style={styles.adminResponseBox}>
                <Text style={styles.adminResponseLabel}>💬 관리자 답변</Text>
                <Text style={styles.adminResponseText}>{item.admin_response}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </View>
  );
};
