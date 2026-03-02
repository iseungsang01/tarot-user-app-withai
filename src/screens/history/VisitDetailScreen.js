import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    GradientBackground,
    CustomButton,
    LoadingSpinner,
    AISummaryPanel
} from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { usePolishReview } from '../../hooks/useAI';
import { visitService } from '../../services/visitService';
import { compressImage } from '../../utils/imageOptimizer';
import { toDisplayImageUri } from '../../utils/imageUri';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { handleApiCall, showErrorAlert, showSuccessAlert, createPermissionError } from '../../utils/errorHandler';

const LOCAL_STORAGE_KEY = 'offline_visit_history';

const VisitDetailScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    // HistoryScreen에서 넘겨준 is_manual과 visitId를 받습니다.
    const { visitId, is_manual } = route.params || {};
    const isOffMode = is_manual === true; // 명확하게 boolean으로 판별
    const { customer } = useAuth();

    const [s, setS] = useState({
        uri: null,
        title: '',
        review: '',
        visit_date: new Date().toISOString(), // 기본값은 현재시간
        loading: !!visitId, // 수정 모드일 때만 로딩 활성화
        saving: false,
        isEdit: !!visitId
    });

    const up = (next) => setS(p => ({ ...p, ...next }));
    const [aiInsight, setAiInsight] = useState(null);
    const [selectedReviewVersion, setSelectedReviewVersion] = useState('original');
    const { result: polishedReview, loading: polishing, error: polishError, polish, reset: resetPolish } = usePolishReview();


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
                        title: item.title || item.drawer_title || '',
                        review: item.card_review,
                        visit_date: item.visit_date, // 기존 날짜 유지
                        loading: false
                    });
                    setAiInsight(item.ai_insight || null);
                    setSelectedReviewVersion('original');
                    resetPolish();
                }
            } else {
                // --- [ON 모드] 서버 데이터 불러오기 ---
                const { data } = await handleApiCall('VisitDetail.load', () => visitService.getVisit(visitId));
                if (data) {
                    up({
                        uri: data.card_image,
                        title: data.title || data.drawer_title || '',
                        review: data.card_review || '',
                        visit_date: data.visit_date, // 서버에 기록된 실제 방문 날짜 유지
                        loading: false
                    });
                    setAiInsight(data.ai_insight || null);
                    setSelectedReviewVersion('original');
                    resetPolish();
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
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.7
        });

        if (!res.canceled && res.assets[0]) {
            try {
                const comp = await compressImage(res.assets[0].uri, { maxWidth: 800, quality: 0.6 });
                up({ uri: comp.base64 });
            } catch { Alert.alert("오류", "이미지 처리에 실패했습니다."); }
        }
    };


    const effectiveReview = useMemo(() => (
        selectedReviewVersion === 'polished' && polishedReview ? polishedReview : s.review
    ), [selectedReviewVersion, polishedReview, s.review]);

    const runPolish = async () => {
        await polish(s.review);
        setSelectedReviewVersion('polished');
    };

    const onSave = async () => {
        if (!s.uri && !s.review.trim() && !s.title.trim()) return Alert.alert("알림", "제목 또는 기록할 내용을 입력해주세요.");
        up({ saving: true });

        const payload = {
            card_review: effectiveReview.trim(),
            card_image: s.uri,
            visit_date: s.visit_date, // 새로 생성 시는 Now, 수정 시는 기존 날짜
            customer_id: customer?.id,
            is_manual: isOffMode,
            title: s.title.trim(),
            ai_insight: aiInsight
        };

        try {
            if (isOffMode) {
                // --- [OFF 모드] 로컬 저장 로직 ---
                const stored = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
                let list = stored ? JSON.parse(stored) : [];

                const localPayload = { ...payload };

                if (s.isEdit) {
                    list = list.map(v => v.id === visitId ? { ...v, ...localPayload } : v);
                } else {
                    list = [{ ...localPayload, id: `local_${Date.now()}` }, ...list];
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

    const insertVoiceMemoMarker = () => {
        const now = new Date();
        const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const marker = `\n🎙️ [음성 메모 ${stamp}] `;
        up({ review: `${s.review}${marker}` });
        Alert.alert('안내', '실녹음/업로드 기능은 다음 버전에서 제공됩니다. 우선 음성 메모 표시를 빠르게 남길 수 있게 구성했어요.');
    };


    const handleAIResult = useCallback((result) => {
        setAiInsight(result || null);
    }, []);

    const clearAIInsight = useCallback(() => {
        setAiInsight(null);
    }, []);

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


                        <TextInput
                            style={[styles.titleInput, { borderColor: theme.c + '40' }]}
                            value={s.title}
                            onChangeText={v => up({ title: v })}
                            placeholder="서랍 제목을 입력하세요"
                            placeholderTextColor="#888"
                            maxLength={40}
                        />

                        <View style={[styles.imgBox, { borderColor: theme.c }]}>
                            {s.uri ? (
                                <>
                                    <Image
                                        source={{ uri: toDisplayImageUri(s.uri) }}
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

                        <View style={[styles.buttonRow, styles.btnRow]}>
                            <CustomButton
                                title="📸 촬영하기"
                                onPress={() => onPick('cam')}
                                style={styles.rowButton}
                                textStyle={styles.buttonTextCompact}
                                numberOfLines={1}
                                allowFontScaling={false}
                                ellipsizeMode="tail"
                            />
                            <CustomButton
                                title="🖼️ 앨범에서 선택"
                                onPress={() => onPick('lib')}
                                style={styles.rowButton}
                                textStyle={styles.buttonTextCompact}
                                numberOfLines={1}
                                allowFontScaling={false}
                                ellipsizeMode="tail"
                            />
                        </View>

                        <TextInput
                            style={[styles.input, { borderColor: theme.c + '40' }]}
                            multiline
                            value={s.review}
                            onChangeText={v => up({ review: v })}
                            placeholder={isOffMode ? "비밀스러운 메모를 남겨보세요..." : "상담 내용을 기록해두면 나중에 확인하기 좋아요."}
                            placeholderTextColor="#888"
                        />

                        <View style={[styles.buttonRow, styles.voiceRow]}>
                            <CustomButton
                                title="🎙️ 녹음 메모 추가"
                                onPress={insertVoiceMemoMarker}
                                style={styles.rowButton}
                                textStyle={styles.buttonTextCompact}
                                numberOfLines={1}
                                allowFontScaling={false}
                                ellipsizeMode="tail"
                            />
                            <CustomButton
                                title="📎 녹음 업로드"
                                onPress={insertVoiceMemoMarker}
                                variant="secondary"
                                style={styles.rowButton}
                                textStyle={styles.buttonTextCompact}
                                numberOfLines={1}
                                allowFontScaling={false}
                                ellipsizeMode="tail"
                            />
                        </View>


                        <View style={[styles.polishPanel, { borderColor: theme.c + '50' }]}>
                            <View style={styles.polishHeaderRow}>
                                <Text style={[styles.polishTitle, { color: theme.c }]}>🪄 AI 문장 다듬기</Text>
                                <CustomButton title={polishing ? '다듬는 중...' : 'AI로 다듬기'} onPress={runPolish} loading={polishing} style={styles.polishBtn} textStyle={styles.buttonTextCompact} />
                            </View>
                            {!!polishError && <Text style={styles.polishError}>⚠️ {polishError}</Text>}
                            {!!polishedReview && (
                                <View style={styles.compareWrap}>
                                    <TouchableOpacity style={[styles.versionChip, selectedReviewVersion === 'original' && styles.versionChipActive]} onPress={() => setSelectedReviewVersion('original')}>
                                        <Text style={styles.versionChipText}>직접 작성본</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.versionChip, selectedReviewVersion === 'polished' && styles.versionChipActive]} onPress={() => setSelectedReviewVersion('polished')}>
                                        <Text style={styles.versionChipText}>AI 다듬은본</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        <AISummaryPanel reviewText={effectiveReview} visitDate={s.visit_date} initialResult={aiInsight} onResult={handleAIResult} onClear={clearAIInsight} />

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
    header: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 16, fontWeight: 'bold' },
    imgBox: { width: '100%', aspectRatio: 3 / 4, maxHeight: 320, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 15, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 12, overflow: 'hidden', alignSelf: 'center' },
    fullImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    delBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,0,0,0.6)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    placeholderContainer: { alignItems: 'center' },
    placeholderText: { fontSize: 34, marginBottom: 8 },
    placeholderSubText: { color: '#888', fontSize: 13 },
    buttonRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch', minHeight: 50 },
    btnRow: { marginBottom: 14 },
    rowButton: { flex: 1, minHeight: 50, alignSelf: 'stretch' },
    titleInput: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#FFF', fontSize: 14, borderWidth: 1, marginBottom: 12 },
    input: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14, color: '#FFF', minHeight: 150, textAlignVertical: 'top', fontSize: 14, borderWidth: 1 },
    voiceRow: { marginTop: 10 },
    whiteText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
    saveBtn: { marginTop: 20, height: 50 },
    polishPanel: { marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 10, backgroundColor: 'rgba(255,255,255,0.04)' },
    polishHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    polishTitle: { fontWeight: '700', fontSize: 13 },
    polishBtn: { minWidth: 108, height: 36 },
    polishError: { color: '#ff9e9e', marginTop: 8, fontSize: 12 },
    compareWrap: { marginTop: 8, flexDirection: 'row', gap: 8 },
    versionChip: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingVertical: 7, alignItems: 'center' },
    versionChipActive: { borderColor: DrawerTheme.goldBright, backgroundColor: 'rgba(212,175,55,0.18)' },
    versionChipText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
    buttonTextCompact: { fontSize: 13 }
});

export default VisitDetailScreen;
