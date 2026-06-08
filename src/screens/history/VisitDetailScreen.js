import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Image,
    TouchableOpacity,
    ScrollView,
    Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import {
    ArchiveTitleHeader,
    CustomButton,
    GoldActionButton,
    LoadingSpinner,
    PremiumCard,
    ScreenContainer,
} from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { usePolishReview } from '../../hooks/useAI';
import { visitService } from '../../services/visitService';
import { compressImage } from '../../utils/imageOptimizer';
import { toDisplayImageUri } from '../../utils/imageUri';
import { storage, STORAGE_KEYS } from '../../utils/storage';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { TextColors } from '../../constants/Colors';
import { handleApiCall, showErrorAlert, showSuccessAlert, createPermissionError } from '../../utils/errorHandler';

const ACTION_VARIANT = {
    PRIMARY: 'primary',
    SECONDARY: 'secondary',
};

const PICKER_OPTIONS = { allowsEditing: true, quality: 0.7 };
const COMPRESS_OPTIONS = { maxWidth: 800, quality: 0.6 };

const VisitDetailScreen = ({ route, navigation }) => {
    const insets = useSafeAreaInsets();
    const { visitId, is_manual } = route.params || {};
    const isOffMode = is_manual === true;
    const { customer } = useAuth();

    const [s, setS] = useState({
        uri: null,
        title: '',
        review: '',
        visit_date: new Date().toISOString(),
        loading: !!visitId,
        saving: false,
        isEdit: !!visitId,
    });

    const reviewInputRef = useRef(null);
    const up = (next) => setS((p) => ({ ...p, ...next }));
    const [voiceInputAvailable, setVoiceInputAvailable] = useState(true);
    const [aiInsight, setAiInsight] = useState(null);
    const [selectedReviewVersion, setSelectedReviewVersion] = useState('original');
    const {
        result: polishedReview,
        loading: polishing,
        error: polishError,
        remaining: polishRemaining,
        polish,
        reset: resetPolish,
    } = usePolishReview();

    const isBusy = s.saving || polishing;
    const hasReview = !!s.review.trim();

    useEffect(() => {
        if (visitId) loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitId]);

    const loadData = async () => {
        try {
            if (isOffMode) {
                const list = (await storage.get(STORAGE_KEYS.OFFLINE_VISIT_HISTORY)) || [];
                const item = list.find((v) => v.id === visitId);
                if (!item) {
                    Alert.alert('기록 없음', '로컬 개인 기록을 찾을 수 없습니다.', [
                        { text: '돌아가기', onPress: () => navigation.goBack() },
                    ]);
                    return;
                }

                up({
                    uri: item.card_image,
                    title: item.title || item.drawer_title || '',
                    review: item.card_review || '',
                    visit_date: item.visit_date,
                });
                setAiInsight(item.ai_insight || null);
                setSelectedReviewVersion('original');
                resetPolish();
                return;
            }

            const { data, error } = await handleApiCall('VisitDetail.load', () => visitService.getVisit(visitId));
            if (error || !data) {
                Alert.alert('기록을 불러올 수 없습니다', '상담 기록을 찾을 수 없거나 다시 로그인이 필요합니다.', [
                    { text: '돌아가기', onPress: () => navigation.goBack() },
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
        } catch {
            Alert.alert('기록을 불러올 수 없습니다', '잠시 후 다시 시도해 주세요.', [
                { text: '돌아가기', onPress: () => navigation.goBack() },
            ]);
        } finally {
            up({ loading: false });
        }
    };

    const onPick = async (type) => {
        const perm = type === 'cam'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') return showErrorAlert(createPermissionError(type.toUpperCase()), Alert);

        const res = await (type === 'cam' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync)(PICKER_OPTIONS);

        if (!res.canceled && res.assets?.[0]?.uri) {
            try {
                const comp = await compressImage(res.assets[0].uri, COMPRESS_OPTIONS);
                up({ uri: comp.base64 || comp.uri });
            } catch {
                Alert.alert('오류', '이미지 처리에 실패했습니다.');
            }
        }
    };

    const pickImage = () => {
        if (isBusy) return;
        Alert.alert('사진 첨부', '이미지 가져오기 방식을 선택하세요.', [
            { text: '취소', style: 'cancel' },
            { text: '카메라 촬영', onPress: () => onPick('cam') },
            { text: '앨범에서 선택', onPress: () => onPick('lib') },
        ]);
    };

    const effectiveReview = useMemo(() => (
        selectedReviewVersion === 'polished' && polishedReview ? polishedReview : s.review
    ), [selectedReviewVersion, polishedReview, s.review]);

    const runPolish = async () => {
        if (polishing) return;
        if (!hasReview) {
            Alert.alert('메모가 필요합니다', '먼저 메모를 입력해 주세요.');
            return;
        }
        const { data } = await polish(s.review);
        if (data) setSelectedReviewVersion('polished');
    };

    const handleReviewChange = (value) => {
        up({ review: value });
        if (polishedReview) {
            setSelectedReviewVersion('original');
            resetPolish();
        }
    };

    const applyPolishedToMemo = () => {
        if (!polishedReview) return;
        up({ review: polishedReview });
        setSelectedReviewVersion('original');
        resetPolish();
    };

    const onSave = async () => {
        if (s.saving) return;
        if (!s.uri && !s.review.trim() && !s.title.trim()) {
            Alert.alert('알림', '제목 또는 기록 내용을 입력해 주세요.');
            return;
        }
        up({ saving: true });

        const payload = {
            card_review: effectiveReview.trim(),
            card_image: s.uri,
            visit_date: s.visit_date,
            customer_id: customer?.id,
            is_manual: isOffMode,
            title: s.title.trim(),
            ai_insight: aiInsight,
        };

        try {
            if (isOffMode) {
                let list = (await storage.get(STORAGE_KEYS.OFFLINE_VISIT_HISTORY)) || [];
                const localPayload = { ...payload };

                if (s.isEdit) {
                    list = list.map((v) => (v.id === visitId ? { ...v, ...localPayload } : v));
                } else {
                    list = [{ ...localPayload, id: `local_${Date.now()}` }, ...list];
                }

                await storage.save(STORAGE_KEYS.OFFLINE_VISIT_HISTORY, list);
            } else {
                const localOnlyPayload = {
                    card_review: payload.card_review,
                    card_image: payload.card_image,
                    title: payload.title,
                    ai_insight: payload.ai_insight,
                };
                const { error } = await handleApiCall('Visit.save', () =>
                    visitService.updateVisit(visitId, localOnlyPayload),
                );
                if (error) throw error;
            }

            showSuccessAlert(s.isEdit ? 'UPDATE' : 'SAVE', Alert);
            setTimeout(() => navigation.goBack(), 1000);
        } catch {
            up({ saving: false });
        }
    };

    const startVoiceInput = () => {
        if (Platform.OS === 'web') {
            setVoiceInputAvailable(false);
            Alert.alert('음성 입력을 사용할 수 없습니다', '미리보기에서는 음성 입력을 사용할 수 없습니다. Android 앱에서 이용해 주세요.');
            return;
        }

        setVoiceInputAvailable(true);
        reviewInputRef.current?.focus();
        Keyboard.dismiss();
        setTimeout(() => reviewInputRef.current?.focus(), 100);
        Alert.alert('음성 입력 안내', '키보드가 열리면 키보드의 마이크 버튼을 눌러 말해 주세요. 인식된 문장은 메모 칸에 바로 입력됩니다.');
    };

    if (s.loading) return <ScreenContainer><LoadingSpinner /></ScreenContainer>;

    const theme = isOffMode
        ? { c: DrawerTheme.mutedPurple, bg: DrawerTheme.velvetPurple, placeholder: TextColors.inputPlaceholderOff }
        : { c: DrawerTheme.brightGold, bg: DrawerTheme.walnut, placeholder: TextColors.inputPlaceholderOn };

    return (
        <ScreenContainer safeTop={false} safeBottom={false}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 50 }]}>
                    <ArchiveTitleHeader
                        eyebrow={isOffMode ? 'PRIVATE DRAWER' : 'DRAWER NOTE'}
                        title={isOffMode ? '\uAC1C\uC778 \uC11C\uB78D \uC791\uC131' : '\uC11C\uB78D \uAE30\uB85D \uC815\uB9AC'}
                        subtitle={isOffMode ? '\uB098\uB9CC\uC758 \uBA54\uBAA8\uB97C \uC11C\uB78D\uC5D0 \uBCF4\uAD00\uD569\uB2C8\uB2E4' : '\uD0C0\uB85C \uC0C1\uB2F4 \uAE30\uB85D\uC744 \uC815\uB9AC\uD569\uB2C8\uB2E4'}
                        style={styles.header}
                    />

                        <PremiumCard style={styles.formCard}>
                            <Text style={styles.sectionLabel}>서랍 명패</Text>
                            <TextInput
                                style={[styles.titleInput, { borderColor: `${theme.c}66` }]}
                                value={s.title}
                                onChangeText={(v) => up({ title: v })}
                                placeholder="서랍 제목을 입력하세요"
                                placeholderTextColor={theme.placeholder}
                                maxLength={40}
                                accessibilityLabel="서랍 제목 입력"
                            />
                        </PremiumCard>

                        <PremiumCard style={styles.formCard}>
                            <Text style={styles.sectionLabel}>상담/개인 메모</Text>
                            <Text style={styles.helperText}>음성 입력이나 직접 입력으로 기억하고 싶은 내용을 남겨두세요.</Text>
                            <TextInput
                                ref={reviewInputRef}
                                style={[styles.input, { borderColor: `${theme.c}66` }]}
                                multiline
                                value={s.review}
                                onChangeText={handleReviewChange}
                                placeholder={isOffMode ? '비밀 서랍에 둘 메모를 적어보세요.' : '상담 내용을 기록해 두면 나중에 확인하기 좋습니다.'}
                                placeholderTextColor={theme.placeholder}
                                accessibilityLabel="상담 또는 개인 메모 입력"
                                textAlignVertical="top"
                            />

                            <View style={[styles.buttonRow, styles.voiceRow]}>
                                <CustomButton
                                    title={voiceInputAvailable ? '음성 입력 하기' : '음성 입력 불가'}
                                    onPress={startVoiceInput}
                                    variant={ACTION_VARIANT.SECONDARY}
                                    style={styles.rowButton}
                                    textStyle={styles.compactButtonText}
                                    numberOfLines={1}
                                    allowFontScaling={false}
                                    disabled={isBusy}
                                    accessibilityLabel="음성 입력 하기"
                                />
                                <CustomButton
                                    title={polishing ? '다듬는 중...' : 'AI로 다듬기'}
                                    onPress={runPolish}
                                    loading={polishing}
                                    disabled={!hasReview || s.saving || polishing}
                                    variant={ACTION_VARIANT.SECONDARY}
                                    style={styles.rowButton}
                                    textStyle={styles.compactButtonText}
                                    numberOfLines={1}
                                    allowFontScaling={false}
                                    accessibilityLabel="AI로 문장 다듬기"
                                />
                            </View>
                            <Text style={styles.helperText}>AI로 다듬기는 메모 의미를 유지하고 문장만 자연스럽게 정리합니다.</Text>
                            <Text style={styles.voiceUsageText}>
                                {polishRemaining == null ? '이번 달 AI 문장 다듬기 30회 남음' : `이번 달 AI 문장 다듬기 ${polishRemaining}회 남음`}
                            </Text>

                            <View style={[styles.polishPanel, { borderColor: `${theme.c}55` }]}>
                                <Text style={[styles.polishTitle, { color: theme.c }]}>AI 문장 다듬기</Text>
                                {!!polishError && <Text style={styles.errorText}>⚠ {polishError}</Text>}
                                {!!polishedReview && (
                                    <View style={styles.compareWrap}>
                                        <TouchableOpacity style={[styles.versionChip, selectedReviewVersion === 'original' && styles.versionChipActive]} onPress={() => setSelectedReviewVersion('original')} accessibilityRole="button" accessibilityLabel="직접 작성본 보기">
                                            <Text style={styles.versionChipText}>직접 작성본</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.versionChip, selectedReviewVersion === 'polished' && styles.versionChipActive]} onPress={() => setSelectedReviewVersion('polished')} accessibilityRole="button" accessibilityLabel="AI 다듬은 본 보기">
                                            <Text style={styles.versionChipText}>AI 다듬은 본</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                {!!polishedReview && (
                                    <>
                                        <View style={styles.polishPreviewBox}>
                                            <Text style={styles.polishPreviewLabel}>
                                                {selectedReviewVersion === 'polished' ? 'AI 다듬은 본 미리보기' : '직접 작성본 미리보기'}
                                            </Text>
                                            <Text style={styles.polishPreviewText}>
                                                {selectedReviewVersion === 'polished' ? polishedReview : s.review}
                                            </Text>
                                        </View>
                                        <Text style={styles.polishSaveHint}>
                                            {selectedReviewVersion === 'polished'
                                                ? '이 상태로 저장하면 AI 다듬은 본이 기록에 저장됩니다.'
                                                : '기존 메모를 유지하려면 직접 작성본을 선택한 채 저장하세요.'}
                                        </Text>
                                        <View style={styles.polishActionRow}>
                                            <TouchableOpacity
                                                style={[styles.polishActionButton, styles.polishApplyButton]}
                                                onPress={applyPolishedToMemo}
                                                accessibilityRole="button"
                                                accessibilityLabel="AI 다듬은 본을 메모 칸에 적용"
                                            >
                                                <Text style={styles.polishActionText}>메모 칸에 적용</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.polishActionButton}
                                                onPress={() => {
                                                    setSelectedReviewVersion('original');
                                                    resetPolish();
                                                }}
                                                accessibilityRole="button"
                                                accessibilityLabel="AI 다듬은 본 닫기"
                                            >
                                                <Text style={styles.polishActionText}>닫기</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                            </View>
                        </PremiumCard>

                        <PremiumCard style={styles.formCard}>
                            <Text style={styles.sectionLabel}>카드 사진</Text>
                            <TouchableOpacity
                                style={[styles.uploadButton, { borderColor: `${theme.c}66` }]}
                                onPress={pickImage}
                                disabled={isBusy}
                                activeOpacity={0.82}
                                accessibilityRole="button"
                                accessibilityLabel="서랍 사진 첨부"
                            >
                                <Text style={[styles.uploadButtonText, { color: theme.c }]}>사진 첨부 (카메라 · 앨범)</Text>
                            </TouchableOpacity>

                            {!!s.uri && (
                                <View style={styles.previewWrap}>
                                    <Image
                                        source={{ uri: toDisplayImageUri(s.uri) }}
                                        style={styles.previewImage}
                                        resizeMode="contain"
                                    />
                                    <TouchableOpacity
                                        onPress={() => up({ uri: null })}
                                        style={styles.removeImageButton}
                                        accessibilityRole="button"
                                        accessibilityLabel="첨부 사진 제거"
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={styles.removeImageText}>×</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </PremiumCard>

                        <GoldActionButton
                            title={s.saving ? '저장 중...' : (isOffMode ? '개인 서랍에 저장' : '기록 저장')}
                            onPress={onSave}
                            disabled={s.saving || polishing}
                            style={styles.saveBtn}
                            accessibilityLabel="서랍 기록 저장"
                        />
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => navigation.goBack()}
                            disabled={s.saving || polishing}
                            activeOpacity={0.75}
                            style={[styles.bottomBackButton, (s.saving || polishing) && styles.disabled]}
                        >
                            <Text style={styles.bottomBackText}>서랍 기록으로 돌아가기</Text>
                        </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1 },
    scrollContent: { padding: 18, gap: 14 },
    header: { marginBottom: 2 },
    formCard: { borderColor: 'rgba(224,184,90,0.24)' },
    sectionLabel: { color: DrawerTheme.brightGold, fontSize: 13, fontWeight: '900', marginBottom: 8, marginLeft: 2, letterSpacing: 0.8 },
    helperText: { color: DrawerTheme.mutedIvory, fontSize: 12, lineHeight: 17, marginBottom: 8, opacity: 0.82 },
    uploadButton: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,232,208,0.06)' },
    uploadButtonText: { fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
    previewWrap: { marginTop: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(9,0,13,0.62)', borderWidth: 1, borderColor: 'rgba(244,232,208,0.12)' },
    previewImage: { width: '100%', height: 220 },
    removeImageButton: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(74,15,43,0.86)', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(224,184,90,0.4)' },
    removeImageText: { color: DrawerTheme.ivory, fontWeight: '900', fontSize: 22, lineHeight: 24 },
    buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'stretch', minHeight: 50 },
    rowButton: { flex: 1, minWidth: 130, minHeight: 50, alignSelf: 'stretch' },
    compactButtonText: { fontSize: 13, fontWeight: '700' },
    titleInput: { backgroundColor: 'rgba(244,232,208,0.07)', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: DrawerTheme.ivory, fontSize: 14, borderWidth: 1, marginBottom: 16 },
    input: { backgroundColor: 'rgba(244,232,208,0.07)', borderRadius: 14, padding: 14, color: DrawerTheme.ivory, minHeight: 150, fontSize: 14, lineHeight: 21, borderWidth: 1 },
    voiceRow: { marginTop: 10, marginBottom: 8 },
    voiceUsageText: { color: DrawerTheme.mutedIvory, fontSize: 12, marginTop: 2, marginLeft: 2, opacity: 0.82 },
    saveBtn: { marginTop: 4, minHeight: 54 },
    polishPanel: { marginTop: 12, borderWidth: 1, borderRadius: 14, padding: 12, backgroundColor: 'rgba(9,0,13,0.32)' },
    polishTitle: { fontWeight: '900', fontSize: 14, marginBottom: 4 },
    errorText: { color: '#ffb4b4', marginTop: 8, fontSize: 12, lineHeight: 17 },
    compareWrap: { marginTop: 10, flexDirection: 'row', gap: 8 },
    versionChip: { flex: 1, minWidth: 92, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(244,232,208,0.18)', paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center', backgroundColor: 'rgba(244,232,208,0.05)' },
    versionChipActive: { borderColor: DrawerTheme.goldBright, backgroundColor: 'rgba(212,175,55,0.18)' },
    versionChipText: { color: DrawerTheme.ivory, fontSize: 12, fontWeight: '700' },
    polishPreviewBox: { marginTop: 12, borderRadius: 12, padding: 12, backgroundColor: 'rgba(244,232,208,0.07)', borderWidth: 1, borderColor: 'rgba(244,232,208,0.14)' },
    polishPreviewLabel: { color: DrawerTheme.brightGold, fontSize: 12, fontWeight: '900', marginBottom: 6 },
    polishPreviewText: { color: DrawerTheme.ivory, fontSize: 14, lineHeight: 22 },
    polishSaveHint: { color: DrawerTheme.mutedIvory, fontSize: 12, lineHeight: 17, marginTop: 8, opacity: 0.86 },
    polishActionRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
    polishActionButton: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(244,232,208,0.18)', paddingVertical: 9, paddingHorizontal: 8, alignItems: 'center', backgroundColor: 'rgba(244,232,208,0.05)' },
    polishApplyButton: { borderColor: DrawerTheme.goldBright, backgroundColor: 'rgba(212,175,55,0.18)' },
    polishActionText: { color: DrawerTheme.ivory, fontSize: 12, fontWeight: '800' },
    bottomBackButton: { alignSelf: 'center', marginTop: 4, paddingHorizontal: 14, paddingVertical: 10 },
    bottomBackText: { color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
    disabled: { opacity: 0.45 },
});

export default VisitDetailScreen;

