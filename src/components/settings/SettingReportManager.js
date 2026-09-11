import { useState } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Text, TextInput } from '../common/AppText';
import * as ImagePicker from 'expo-image-picker';
import { CustomButton } from '../common/CustomButton';
import { styles } from '../../styles/SettingsStyles';
import { compressImage } from '../../utils/imageOptimizer';
import { toDisplayImageUri } from '../../utils/imageUri';

import { dialog } from '../../utils/dialog';
const INITIAL_REPORT_DATA = {
  title: '',
  description: '',
  screenshot: null,
};

// 서버가 돌려주는 report_type 은 ASCII 코드다. 한글 리터럴을 키로 두면 인코딩
// 사고에서 데이터가 깨지기 때문에 코드로 저장하고 라벨은 여기서 붙인다.
// chk_bug_reports_report_type 이 VALIDATED 라 이 4종 외의 값은 들어올 수 없지만,
// 매니저가 종류를 늘릴 수 있으므로 모르는 값은 원문을 그대로 보여준다.
const REPORT_TYPE_LABELS = {
  app_bug: '앱 버그',
  feature_request: '기능 요청',
  store_request: '매장 요청',
  etc: '기타',
};

const reportTypeLabel = (value) => REPORT_TYPE_LABELS[value] || value || '앱 버그';

const PICKER_OPTIONS = { allowsEditing: true, quality: 0.7 };
const COMPRESS_OPTIONS = { maxWidth: 1000, quality: 0.6 };

export const SettingReportManager = ({ myReports, onSubmit, getStatusColor, processing, onOpenDetail }) => {
  const [reportData, setReportData] = useState(INITIAL_REPORT_DATA);

  const handleFieldChange = (field, value) => {
    setReportData(prev => ({ ...prev, [field]: value }));
  };

  const pickImageWith = async (requestPermission, launchPicker) => {
    const perm = await requestPermission();
    if (perm.status !== 'granted') return;

    const res = await launchPicker(PICKER_OPTIONS);
    if (!res.canceled && res.assets?.[0]?.uri) {
      const comp = await compressImage(res.assets[0].uri, COMPRESS_OPTIONS);
      setReportData(prev => ({ ...prev, screenshot: comp.base64 }));
    }
  };

  const pickImageFromLibrary = () => pickImageWith(
    ImagePicker.requestMediaLibraryPermissionsAsync,
    ImagePicker.launchImageLibraryAsync
  );

  const pickImageFromCamera = () => pickImageWith(
    ImagePicker.requestCameraPermissionsAsync,
    ImagePicker.launchCameraAsync
  );

  const pickImage = () => {
    dialog.alert('스크린샷 첨부', '이미지 가져오기 방식을 선택하세요.', [
      { text: '취소', style: 'cancel' },
      { text: '카메라 촬영', onPress: pickImageFromCamera },
      { text: '앨범에서 선택', onPress: pickImageFromLibrary },
    ]);
  };

  const handleSubmit = async () => {
    const submitted = await onSubmit(reportData);
    if (submitted) setReportData(INITIAL_REPORT_DATA);
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.innerTitle}>앱 버그 접수</Text>
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
        <Text style={styles.uploadButtonText}>스크린샷 첨부 (카메라/앨범)</Text>
      </TouchableOpacity>
      {!!reportData.screenshot && (
        <Image
          source={{ uri: toDisplayImageUri(reportData.screenshot) }}
          style={styles.previewImage}
          resizeMode='contain'
        />
      )}

      <CustomButton
        title="접수하기"
        onPress={handleSubmit}
        loading={processing}
        style={{ marginTop: 10 }}
      />

      <View style={styles.sectionDivider} />
      <Text style={styles.innerTitle}> 내 접수 내역 ({myReports.length})</Text>
      {myReports.length === 0 ? (
        <Text style={styles.emptyText}>접수 내역이 없습니다.</Text>
      ) : (
        myReports.map(item => (
          <TouchableOpacity key={item.id} style={styles.historyCard} activeOpacity={0.8} onPress={() => onOpenDetail?.(item)}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyType}>{reportTypeLabel(item.report_type)}</Text>
              <View style={[styles.statusBadge, { borderColor: getStatusColor(item.status) }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.historyDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
            <Text style={styles.detailText}>상세 보기 →</Text>

            {item.admin_response && item.admin_response.trim() !== '' && (
              <View style={styles.adminResponseBox}>
                <Text style={styles.adminResponseLabel}> 관리자 답변</Text>
                <Text style={styles.adminResponseText}>{item.admin_response}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </View>
  );
};
