import { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
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
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

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

import { dialog } from '../../utils/dialog';
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
    const scrollRef = useRef(null);
    const memoTopRef = useRef(0);
    const up = (next) => setS((p) => ({ ...p, ...next }));

    /**
     * 메모 칸을 화면 맨 위로 끌어올린다.
     *
     * Android 는 KeyboardAvoidingView 가 동작하지 않고(behavior=undefined),
     * windowSoftInputMode=adjustResize 는 창만 줄일 뿐 포커스된 입력창까지
     * 스크롤해주지 않는다. 그대로 두면 서너 줄만 넘어가도 커서가 키보드에 가려
     * 자기가 뭘 쓰는지 볼 수 없다. 키보드가 올라온 뒤 스크롤해야 해서 지연을 준다.
     */
    const scrollMemoIntoView = () => {
        setTimeout(() => {
            scrollRef.current?.scrollTo({ y: Math.max(memoTopRef.current - 8, 0), animated: true });
        }, 260);
    };
    const [voiceInputAvailable, setVoiceInputAvailable] = useState(true);
    const [recognizing, setRecognizing] = useState(false);
    const voiceBaseRef = useRef('');
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
                    dialog.alert('기록 없음', '로컬 개인 기록을 찾을 수 없습니다.', [
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
                dialog.alert('기록을 불러올 수 없습니다', '상담 기록을 찾을 수 없거나 다시 로그인이 필요합니다.', [
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
            dialog.alert('기록을 불러올 수 없습니다', '잠시 후 다시 시도해 주세요.', [
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
        if (perm.status !== 'granted') return showErrorAlert(createPermissionError(type.toUpperCase()));

        const res = await (type === 'cam' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync)(PICKER_OPTIONS);

        if (!res.canceled && res.assets?.[0]?.uri) {
            try {
                const comp = await compressImage(res.assets[0].uri, COMPRESS_OPTIONS);
                up({ uri: comp.base64 || comp.uri });
            } catch {
                dialog.alert('오류', '이미지 처리에 실패했습니다.');
            }
        }
    };

    const pickImage = () => {
        if (isBusy) return;
        dialog.alert('사진 첨부', '이미지 가져오기 방식을 선택하세요.', [
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
            dialog.alert('메모가 필요합니다', '먼저 메모를 입력해 주세요.');
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
            dialog.alert('알림', '제목 또는 기록 내용을 입력해 주세요.');
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

            // 안내를 사용자가 닫은 뒤에 돌아간다. 타이머로 넘겨버리면
            // 다이얼로그만 목록 화면 위에 덩그러니 남는다.
            await showSuccessAlert(s.isEdit ? 'UPDATE' : 'SAVE');
            navigation.goBack();
        } catch {
            up({ saving: false });
        }
    };

    useSpeechRecognitionEvent('start', () => setRecognizing(true));
    useSpeechRecognitionEvent('end', () => setRecognizing(false));

    useSpeechRecognitionEvent('result', (event) => {
        const transcript = event.results?.[0]?.transcript?.trim();
        if (!transcript) return;
        const base = voiceBaseRef.current;
        handleReviewChange(base ? `${base} ${transcript}` : transcript);
    });

    useSpeechRecognitionEvent('error', (event) => {
        setRecognizing(false);
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        dialog.alert('음성 인식을 마치지 못했습니다', event.message || '잠시 후 다시 시도해 주세요.');
    });

    useEffect(() => () => {
        if (Platform.OS !== 'web') ExpoSpeechRecognitionModule.abort();
    }, []);

    const startVoiceInput = async () => {
        if (Platform.OS === 'web') {
            setVoiceInputAvailable(false);
            dialog.alert('음성 입력을 사용할 수 없습니다', '미리보기에서는 음성 입력을 사용할 수 없습니다. Android 앱에서 이용해 주세요.');
            return;
        }

        if (recognizing) {
            ExpoSpeechRecognitionModule.stop();
            return;
        }

        const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!perm.granted) {
            setVoiceInputAvailable(false);
            dialog.alert('마이크 권한이 필요합니다', '설정 > 앱 > 권한에서 마이크를 허용하면 음성으로 기록할 수 있습니다.');
            return;
        }

        setVoiceInputAvailable(true);
        Keyboard.dismiss();
        voiceBaseRef.current = s.review.trim();

        try {
            ExpoSpeechRecognitionModule.start({
                lang: 'ko-KR',
                interimResults: true,
                continuous: false,
                requiresOnDeviceRecognition: false,
                addsPunctuation: false,
            });
        } catch {
            setRecognizing(false);
            dialog.alert('음성 인식을 시작할 수 없습니다', '기기의 음성 인식 서비스를 사용할 수 없습니다.');
        }
    };

    if (s.loading) return <ScreenContainer><LoadingSpinner /></ScreenContainer>;

    const theme = isOffMode
        ? { c: DrawerTheme.mutedPurple, bg: DrawerTheme.velvetPurple, placeholder: TextColors.inputPlaceholderOff }
        : { c: DrawerTheme.brightGold, bg: DrawerTheme.walnut, placeholder: TextColors.inputPlaceholderOn };

    return (
        <ScreenContainer safeTop={false} safeBottom={false}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                <ScrollView
                    ref={scrollRef}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 50 }]}
                >
                    <ArchiveTitleHeader
                        eyebrow={isOffMode ? 'Private Drawer' : 'Drawer Note'}
                        title={isOffMode ? 'PRIVATE NOTE' : 'VISIT RECORD'}
                        subtitle={isOffMode ? '\uAC1C\uC778 \uC11C\uB78D \uC791\uC131' : '\uC11C\uB78D \uAE30\uB85D \uC815\uB9AC'}
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

                        <View onLayout={(e) => { memoTopRef.current = e.nativeEvent.layout.y; }}>
                        <PremiumCard style={styles.formCard}>
                            <Text style={styles.sectionLabel}>상담/개인 메모</Text>
                            <Text style={styles.helperText}>
                                {recognizing
                                    ? '말씀하시면 바로 적힙니다. 버튼을 다시 누르면 멈춥니다.'
                                    : '기억하고 싶은 내용을 남겨두세요. 말로 입력할 수도 있습니다.'}
                            </Text>
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
                                onFocus={scrollMemoIntoView}
                            />

                            <View style={[styles.buttonRow, styles.voiceRow]}>
                                <CustomButton
                                    title={recognizing ? '● 듣는 중' : (voiceInputAvailable ? '음성 입력 하기' : '음성 입력 불가')}
                                    onPress={startVoiceInput}
                                    variant={ACTION_VARIANT.SECONDARY}
                                    style={styles.rowButton}
                                    textStyle={[styles.compactButtonText, recognizing && styles.voiceActiveText]}
                                    numberOfLines={1}
                                    allowFontScaling={false}
                                    disabled={isBusy}
                                    accessibilityLabel={recognizing ? '음성 입력 중지' : '음성 입력 시작'}
                                />
                                <CustomButton
                                    title={polishing ? '다듬는 중...' : 'AI로 다듬기'}
                                    onPress={runPolish}
                                    loading={polishing}
                                    disabled={!hasReview || s.saving || polishing || recognizing}
                                    variant={ACTION_VARIANT.SECONDARY}
                                    style={styles.rowButton}
                                    textStyle={styles.compactButtonText}
                                    numberOfLines={1}
                                    allowFontScaling={false}
                                    accessibilityLabel="AI로 문장 다듬기"
                                />
                            </View>
                            <Text style={styles.voiceUsageText}>
                                내용은 그대로 두고 문장만 정리합니다 · 이번 달 {polishRemaining ?? 30}회 남음
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
                                                ? '지금 저장하면 AI 다듬은 본이 저장됩니다.'
                                                : '지금 저장하면 직접 작성본이 저장됩니다.'}
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
                        </View>

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
    scrollContent: { padding: 14, gap: 10 },
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
    titleInput: { backgroundColor: 'rgba(244,232,208,0.07)', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, color: DrawerTheme.ivory, fontSize: 14, borderWidth: 1, marginBottom: 10 },
    input: { backgroundColor: 'rgba(244,232,208,0.07)', borderRadius: 14, padding: 12, color: DrawerTheme.ivory, minHeight: 128, fontSize: 14, lineHeight: 21, borderWidth: 1 },
    voiceRow: { marginTop: 10, marginBottom: 8 },
    voiceActiveText: { color: DrawerTheme.goldBright, fontWeight: '900' },
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

