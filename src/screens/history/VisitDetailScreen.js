import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image, TouchableOpacity, ScrollView, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import {
    GradientBackground,
    CustomButton,
    LoadingSpinner,
    AISummaryPanel
} from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { usePolishReview, useCondenseVoiceMemo } from '../../hooks/useAI';
import { visitService } from '../../services/visitService';
import { compressImage } from '../../utils/imageOptimizer';
import { toDisplayImageUri } from '../../utils/imageUri';
import { storage, STORAGE_KEYS } from '../../utils/storage';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { TextColors } from '../../constants/Colors';
import { handleApiCall, showErrorAlert, showSuccessAlert, createPermissionError } from '../../utils/errorHandler';


const ACTION_VARIANT = {
    PRIMARY: 'primary',
    SECONDARY: 'secondary'
};

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

    const reviewInputRef = useRef(null);
    const up = (next) => setS(p => ({ ...p, ...next }));
    const [voiceInputAvailable, setVoiceInputAvailable] = useState(true);
    const [condensedVoiceMemo, setCondensedVoiceMemo] = useState('');
    const [aiInsight, setAiInsight] = useState(null);
    const [selectedReviewVersion, setSelectedReviewVersion] = useState('original');
    const { result: polishedReview, loading: polishing, error: polishError, polish, reset: resetPolish } = usePolishReview();
    const { loading: condensingVoice, error: voiceCondenseError, remaining: voiceCondenseRemaining, condense: condenseVoice } = useCondenseVoiceMemo();


    useEffect(() => {
        if (visitId) loadData();
    }, [visitId]);

    const loadData = async () => {
        try {
            if (isOffMode) {
                const list = await storage.get(STORAGE_KEYS.OFFLINE_VISIT_HISTORY) || [];
                const item = list.find(v => v.id === visitId);
                if (!item) {
                    Alert.alert('\uAE30\uB85D \uC5C6\uC74C', '\uC774 \uB85C\uCEEC \uAC1C\uC778 \uAE30\uB85D\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.', [
                        { text: '\uB3CC\uC544\uAC00\uAE30', onPress: () => navigation.goBack() },
                    ]);
                    return;
                }

                up({
                    uri: await storage.getCardImage(visitId) || item.card_image || null,
                    title: await storage.getCardTitle(visitId) || item.title || item.drawer_title || '',
                    review: await storage.getCardReview(visitId) || item.card_review || '',
                    visit_date: item.visit_date,
                });
                setAiInsight(await storage.getCardAIInsight(visitId) || item.ai_insight || null);
                setSelectedReviewVersion('original');
                resetPolish();
                return;
            }

            const { data, error } = await handleApiCall('VisitDetail.load', () => visitService.getVisit(visitId));
            if (error || !data) {
                Alert.alert('\uAE30\uB85D\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4', '\uC0C1\uB2F4 \uAE30\uB85D\uC744 \uCC3E\uC744 \uC218 \uC5C6\uAC70\uB098 \uB2E4\uC2DC \uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.', [
                    { text: '\uB3CC\uC544\uAC00\uAE30', onPress: () => navigation.goBack() },
                ]);
                return;
            }

            up({
                uri: data.card_image,
                title: data.title || data.drawer_title || '',
                review: data.card_review || '',
                visit_date: data.visit_date,
            });
            setAiInsight(data.ai_insight || null);
            setSelectedReviewVersion('original');
            resetPolish();
        } catch (err) {
            Alert.alert('\uAE30\uB85D\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4', '\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.', [
                { text: '\uB3CC\uC544\uAC00\uAE30', onPress: () => navigation.goBack() },
            ]);
        } finally {
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
                up({ uri: comp.base64 || comp.uri });
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
                let list = await storage.get(STORAGE_KEYS.OFFLINE_VISIT_HISTORY) || [];

                const localId = s.isEdit ? visitId : `local_${Date.now()}`;
                const localPayload = {
                    id: localId,
                    visit_date: payload.visit_date,
                    customer_id: payload.customer_id,
                    is_manual: true,
                };

                if (s.isEdit) {
                    list = list.map(v => v.id === localId ? { ...v, ...localPayload } : v);
                } else {
                    list = [localPayload, ...list];
                }

                await storage.save(STORAGE_KEYS.OFFLINE_VISIT_HISTORY, list);
                if (payload.card_image) await storage.saveCardImage(localId, payload.card_image);
                else await storage.deleteCardImage(localId);
                if (payload.card_review) await storage.saveCardReview(localId, payload.card_review);
                else await storage.deleteCardReview(localId);
                if (payload.title) await storage.saveCardTitle(localId, payload.title);
                else await storage.deleteCardTitle(localId);
                if (payload.ai_insight) await storage.saveCardAIInsight(localId, payload.ai_insight);
                else await storage.deleteCardAIInsight(localId);
            } else {
                // --- [ON 모드] 서버 저장 로직 ---
                // 서버 데이터는 이미 visit_history에 행(Row)이 있으므로 보통 updateVisit만 수행합니다.
                const localOnlyPayload = {
                    card_review: payload.card_review,
                    card_image: payload.card_image,
                    title: payload.title,
                    ai_insight: payload.ai_insight
                };
                const { error } = await handleApiCall('Visit.save', () =>
                    visitService.updateVisit(visitId, localOnlyPayload)
                );
                if (error) throw error;
            }

            showSuccessAlert(s.isEdit ? 'UPDATE' : 'SAVE', Alert);
            setTimeout(() => navigation.goBack(), 1000);
        } catch (err) {
            up({ saving: false });
        }
    };

    const startVoiceInput = () => {
        if (Platform.OS === 'web') {
            setVoiceInputAvailable(false);
            Alert.alert('\uC74C\uC131 \uC785\uB825\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4', '\uC6F9 \uBBF8\uB9AC\uBCF4\uAE30\uC5D0\uC11C\uB294 \uD0A4\uBCF4\uB4DC \uC74C\uC131 \uC785\uB825\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. Android \uC571\uC5D0\uC11C \uC774\uC6A9\uD574 \uC8FC\uC138\uC694.');
            return;
        }

        setVoiceInputAvailable(true);
        reviewInputRef.current?.focus();
        Keyboard.dismiss();
        setTimeout(() => reviewInputRef.current?.focus(), 100);
        Alert.alert('\uC74C\uC131 \uC785\uB825 \uC548\uB0B4', '\uD0A4\uBCF4\uB4DC\uAC00 \uC5F4\uB9AC\uBA74 \uD0A4\uBCF4\uB4DC\uC758 \uB9C8\uC774\uD06C \uBC84\uD2BC\uC744 \uB20C\uB7EC \uB9D0\uD574 \uC8FC\uC138\uC694. \uC778\uC2DD\uB41C \uBB38\uC7A5\uC740 \uC774 \uAE30\uB85D \uCE78\uC5D0 \uBC14\uB85C \uC785\uB825\uB418\uBA70 \uC9C1\uC811 \uC218\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
    };

    const runVoiceCondense = async () => {
        if (!s.review.trim()) {
            Alert.alert('\uC54C\uB9BC', '\uCD95\uC57D\uD560 \uC74C\uC131 \uAE30\uB85D\uC744 \uBA3C\uC800 \uC785\uB825\uD574 \uC8FC\uC138\uC694.');
            return;
        }

        const { data, error } = await condenseVoice(s.review);
        if (error || !data) return;
        setCondensedVoiceMemo(data);
    };

    const applyCondensedVoiceMemo = (mode) => {
        if (!condensedVoiceMemo) return;
        if (mode === 'replace') {
            up({ review: condensedVoiceMemo });
        } else {
            const separator = s.review.trim() ? '\n\n[\uB179\uC74C \uB0B4\uC6A9 \uCD95\uC57D]\n' : '';
            up({ review: `${s.review.trim()}${separator}${condensedVoiceMemo}` });
        }
        setCondensedVoiceMemo('');
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
        ? { c: DrawerTheme.navyLight, bg: '#10171E', btn: DrawerTheme.navyMid, placeholder: TextColors.inputPlaceholderOff }
        : { c: DrawerTheme.goldBrass, bg: DrawerTheme.woodMid, btn: DrawerTheme.woodDark, placeholder: TextColors.inputPlaceholderOn };

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
                                {isOffMode ? '✒ 개인 메모 작성' : ' 상담 기록 수정'}
                            </Text>
                        </View>


                        <TextInput
                            style={[styles.titleInput, { borderColor: theme.c + '40' }]}
                            value={s.title}
                            onChangeText={v => up({ title: v })}
                            placeholder="서랍 제목을 입력하세요"
                            placeholderTextColor={theme.placeholder}
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
                                    <Text style={[styles.placeholderText, { color: theme.c }]}></Text>
                                    <Text style={styles.placeholderSubText}>카드를 촬영하거나 선택하세요</Text>
                                </View>
                            )}
                        </View>

                        {/* 3차 액션: 부가 기능 */}
                        <View style={[styles.buttonRow, styles.btnRow]}>
                            <CustomButton
                                title=" 촬영하기"
                                onPress={() => onPick('cam')}
                                variant={ACTION_VARIANT.SECONDARY}
                                style={styles.rowButton}
                                numberOfLines={1}
                                allowFontScaling={false}
                                ellipsizeMode="tail"
                            />
                            <CustomButton
                                title=" 앨범에서 선택"
                                onPress={() => onPick('lib')}
                                variant={ACTION_VARIANT.SECONDARY}
                                style={styles.rowButton}
                                numberOfLines={1}
                                allowFontScaling={false}
                                ellipsizeMode="tail"
                            />
                        </View>

                        <TextInput
                            ref={reviewInputRef}
                            style={[styles.input, { borderColor: theme.c + '40' }]}
                            multiline
                            value={s.review}
                            onChangeText={v => up({ review: v })}
                            placeholder={isOffMode ? "비밀스러운 메모를 남겨보세요..." : "상담 내용을 기록해두면 나중에 확인하기 좋아요."}
                            placeholderTextColor={theme.placeholder}
                        />

                        {/* 3? ??: ?? ??/?? */}
                        <View style={[styles.buttonRow, styles.voiceRow]}>
                            <CustomButton
                                title={voiceInputAvailable ? "\uC74C\uC131 \uC785\uB825 \uC2DC\uC791" : "\uC74C\uC131 \uC785\uB825\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4"}
                                onPress={startVoiceInput}
                                variant={ACTION_VARIANT.SECONDARY}
                                style={styles.rowButton}
                                numberOfLines={1}
                                allowFontScaling={false}
                                ellipsizeMode="tail"
                            />
                            <CustomButton
                                title={condensingVoice ? "\uCD95\uC57D \uC911..." : "\uC74C\uC131 \uAE30\uB85D \uCD95\uC57D"}
                                onPress={runVoiceCondense}
                                loading={condensingVoice}
                                variant={ACTION_VARIANT.SECONDARY}
                                style={styles.rowButton}
                                numberOfLines={1}
                                allowFontScaling={false}
                                ellipsizeMode="tail"
                            />
                        </View>
                        <Text style={styles.voiceUsageText}>
                            {voiceCondenseRemaining == null ? '\uC774\uBC88 \uB2EC \uB179\uC74C \uCD95\uC57D 30\uD68C \uB0A8\uC74C' : `\uC774\uBC88 \uB2EC \uB179\uC74C \uCD95\uC57D ${voiceCondenseRemaining}\uD68C \uB0A8\uC74C`}
                        </Text>
                        {!!voiceCondenseError && <Text style={styles.polishError}>? {voiceCondenseError}</Text>}
                        {!!condensedVoiceMemo && (
                            <View style={styles.voiceCondensePanel}>
                                <Text style={styles.voiceCondenseTitle}>\uB179\uC74C \uB0B4\uC6A9 \uCD95\uC57D \uACB0\uACFC</Text>
                                <Text style={styles.voiceCondenseText}>{condensedVoiceMemo}</Text>
                                <View style={styles.compareWrap}>
                                    <TouchableOpacity style={styles.versionChip} onPress={() => applyCondensedVoiceMemo('replace')}>
                                        <Text style={styles.versionChipText}>\uD604\uC7AC \uAE30\uB85D \uAD50\uCCB4</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.versionChip} onPress={() => applyCondensedVoiceMemo('append')}>
                                        <Text style={styles.versionChipText}>\uC544\uB798\uC5D0 \uB367\uBD99\uC774\uAE30</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}


                        {/* 2차 액션: 편집 보조 */}
                        <View style={[styles.polishPanel, { borderColor: theme.c + '50' }]}> 
                            <View style={styles.polishHeaderRow}>
                                <Text style={[styles.polishTitle, { color: theme.c }]}> AI 문장 다듬기</Text>
                                <CustomButton title={polishing ? '다듬는 중...' : 'AI로 다듬기'} onPress={runPolish} loading={polishing} variant={ACTION_VARIANT.SECONDARY} style={styles.polishBtn} />
                            </View>
                            {!!polishError && <Text style={styles.polishError}>⚠ {polishError}</Text>}
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

                        {/* 1차 액션: 저장 */}
                        <CustomButton
                            title={s.saving ? "저장 중..." : (isOffMode ? "비밀 서랍에 보관" : "기록 서랍에 저장")}
                            onPress={onSave}
                            loading={s.saving}
                            variant={ACTION_VARIANT.PRIMARY}
                            style={styles.saveBtn}
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
    voiceUsageText: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 6, marginLeft: 2 },
    voiceCondensePanel: { marginTop: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', borderRadius: 12, padding: 10, backgroundColor: 'rgba(0,0,0,0.22)' },
    voiceCondenseTitle: { color: DrawerTheme.goldBright, fontWeight: '700', fontSize: 13, marginBottom: 6 },
    voiceCondenseText: { color: '#FFF', fontSize: 13, lineHeight: 19 },
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
    versionChipText: { color: '#FFF', fontSize: 11, fontWeight: '600' }
});

export default VisitDetailScreen;
