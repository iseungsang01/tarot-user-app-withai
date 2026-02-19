import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { GradientBackground } from '../components/GradientBackground';
import { CustomButton } from '../components/CustomButton';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import { visitService } from '../services/visitService';
import { compressImage } from '../utils/imageOptimizer';
import { Colors } from '../constants/Colors';
import { DrawerTheme } from '../constants/DrawerTheme';
import { handleApiCall, showErrorAlert, showSuccessAlert, createPermissionError } from '../utils/errorHandler';

const LOCAL_STORAGE_KEY = 'offline_visit_history';

const VisitDetailScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  // HistoryScreen에서 넘겨준 is_manual과 visitId를 받습니다.
  const { visitId, is_manual } = route.params || {};
  const isOffMode = is_manual === true; // 명확하게 boolean으로 판별
  const { customer } = useAuth();

  const [s, setS] = useState({
    uri: null, 
    review: '', 
    visit_date: new Date().toISOString(), // 기본값은 현재시간
    loading: !!visitId, // 수정 모드일 때만 로딩 활성화
    saving: false,
    isEdit: !!visitId
  });

  const up = (next) => setS(p => ({ ...p, ...next }));

  useEffect(() => {
    if (visitId) loadData();
  }, [visitId]);

  const loadData = async () => {
    try {
      if (isOffMode) {
        // --- [OFF 모드] 로컬 데이터 불러오기 ---
        const stored = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
        const list = stored ? JSON.parse(stored) : [];
        const item = list.find(v => v.id === visitId);
        if (item) {
          up({ 
            uri: item.card_image, 
            review: item.card_review, 
            visit_date: item.visit_date, // 기존 날짜 유지
            loading: false 
          });
        }
      } else {
        // --- [ON 모드] 서버 데이터 불러오기 ---
        const { data } = await handleApiCall('VisitDetail.load', () => visitService.getVisit(visitId));
        if (data) {
          up({ 
            uri: data.card_image, 
            review: data.card_review || '', 
            visit_date: data.visit_date, // 서버에 기록된 실제 방문 날짜 유지
            loading: false 
          });
        }
      }
    } catch (err) {
      up({ loading: false });
    }
  };

  const onPick = async (type) => {
    const perm = type === 'cam' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return showErrorAlert(createPermissionError(type.toUpperCase()), Alert);

    const res = await (type === 'cam' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync)({
      allowsEditing: true, aspect: [4, 3], quality: 0.7
    });
    
    if (!res.canceled && res.assets[0]) {
      try {
        const comp = await compressImage(res.assets[0].uri, { maxWidth: 800, quality: 0.6 });
        up({ uri: comp.base64 });
      } catch { Alert.alert("오류", "이미지 처리에 실패했습니다."); }
    }
  };

  const onSave = async () => {
    if (!s.uri && !s.review.trim()) return Alert.alert("알림", "기록할 내용을 입력해주세요.");
    up({ saving: true });

    const payload = {
      card_review: s.review.trim(),
      card_image: s.uri,
      visit_date: s.visit_date, // 새로 생성 시는 Now, 수정 시는 기존 날짜
      customer_id: customer?.id,
      is_manual: isOffMode
    };

    try {
      if (isOffMode) {
        // --- [OFF 모드] 로컬 저장 로직 ---
        const stored = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
        let list = stored ? JSON.parse(stored) : [];
        
        if (s.isEdit) {
          list = list.map(v => v.id === visitId ? { ...v, ...payload } : v);
        } else {
          list = [{ ...payload, id: `local_${Date.now()}` }, ...list];
        }
        
        await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      } else {
        // --- [ON 모드] 서버 저장 로직 ---
        // 서버 데이터는 이미 visit_history에 행(Row)이 있으므로 보통 updateVisit만 수행합니다.
        const { error } = await handleApiCall('Visit.save', () => 
          visitService.updateVisit(visitId, payload)
        );
        if (error) throw error;
      }
      
      showSuccessAlert(s.isEdit ? 'UPDATE' : 'SAVE', Alert);
      setTimeout(() => navigation.goBack(), 1000);
    } catch (err) {
      up({ saving: false });
    }
  };

  if (s.loading) return <GradientBackground><LoadingSpinner /></GradientBackground>;

  // UI 테마: OFF 모드는 네이비, ON 모드는 황동/나무 색상 적용
  const theme = isOffMode 
    ? { c: DrawerTheme.navyLight, bg: '#10171E', btn: DrawerTheme.navyMid } 
    : { c: DrawerTheme.goldBrass, bg: DrawerTheme.woodMid, btn: DrawerTheme.woodDark };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : null} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 50 }}>
            
            <View style={[styles.header, { backgroundColor: theme.bg, borderColor: theme.c }]}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.whiteText}>← 뒤로</Text>
              </TouchableOpacity>
              <Text style={[styles.title, { color: theme.c }]}>
                {isOffMode ? '✒️ 개인 메모 작성' : '📝 상담 기록 수정'}
              </Text>
            </View>

            <View style={[styles.imgBox, { borderColor: theme.c }]}>
              {s.uri ? (
                <>
                  <Image 
                    source={{ uri: s.uri.startsWith('data') ? s.uri : `data:image/jpeg;base64,${s.uri}` }} 
                    style={styles.fullImg} 
                  />
                  <TouchableOpacity onPress={() => up({ uri: null })} style={styles.delBtn}>
                    <Text style={styles.whiteText}>✕</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.placeholderContainer}>
                  <Text style={[styles.placeholderText, { color: theme.c }]}>📷</Text>
                  <Text style={styles.placeholderSubText}>카드를 촬영하거나 선택하세요</Text>
                </View>
              )}
            </View>

            <View style={styles.btnRow}>
              <CustomButton title="촬영하기" onPress={() => onPick('cam')} style={{flex:1}} />
              <CustomButton title="앨범에서 선택" onPress={() => onPick('lib')} variant="secondary" style={{flex:1}} />
            </View>

            <TextInput 
              style={[styles.input, { borderColor: theme.c + '40' }]} 
              multiline 
              value={s.review} 
              onChangeText={v => up({ review: v })}
              placeholder={isOffMode ? "비밀스러운 메모를 남겨보세요..." : "상담 내용을 기록해두면 나중에 확인하기 좋아요."}
              placeholderTextColor="#888" 
            />
            
            <CustomButton 
              title={s.saving ? "저장 중..." : (isOffMode ? "비밀 서랍에 보관" : "기록 서랍에 저장")} 
              onPress={onSave} 
              loading={s.saving} 
              style={[styles.saveBtn, { backgroundColor: theme.btn }]} 
            />

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
};

const styles = StyleSheet.create({
  header: { padding: 15, borderRadius: 12, borderWidth: 1.5, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold' },
  imgBox: { height: 260, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 15, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 15, overflow: 'hidden' },
  fullImg: { width: '100%', height: '100%' },
  delBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,0,0,0.6)', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  placeholderContainer: { alignItems: 'center' },
  placeholderText: { fontSize: 40, marginBottom: 10 },
  placeholderSubText: { color: '#888', fontSize: 13 },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  input: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 18, color: '#FFF', minHeight: 180, textAlignVertical: 'top', fontSize: 16, borderWidth: 1 },
  whiteText: { color: '#FFF', fontWeight: 'bold' },
  saveBtn: { marginTop: 25, height: 55 }
});

export default VisitDetailScreen;