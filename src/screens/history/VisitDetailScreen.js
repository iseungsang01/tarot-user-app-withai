import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import {
    CustomButton,
    LoadingSpinner,
    AISummaryPanel,
} from '../../components';
import { ArchiveTitleHeader, GoldActionButton, PremiumCard, ScreenContainer } from '../../components/common/PremiumUI';
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
    SECONDARY: 'secondary',
};

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
    const [condensedVoiceMemo, setCondensedVoiceMemo] = useState('');
    const [aiInsight, setAiInsight] = useState(null);
    const [selectedReviewVersion, setSelectedReviewVersion] = useState('original');
    const {
        result: polishedReview,
        loading: polishing,
        error: polishError,
        polish,
        reset: resetPolish,
    } = usePolishReview();
    const {
        loading: condensingVoice,
        error: voiceCondenseError,
        remaining: voiceCondenseRemaining,
        condense: condenseVoice,
    } = useCondenseVoiceMemo();

    const isBusy = s.saving || polishing || condensingVoice;
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

        const res = await (type === 'cam' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync)({
            allowsEditing: true,
            quality: 0.7,
        });

        if (!res.canceled && res.assets[0]) {
            try {
                const comp = await compressImage(res.assets[0].uri, { maxWidth: 800, quality: 0.6 });
                up({ uri: comp.base64 || comp.uri });
            } catch {
                Alert.alert('오류', '이미지 처리에 실패했습니다.');
            }
        }
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
        await polish(s.review);
        setSelectedReviewVersion('polished');
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

    const runVoiceCondense = async () => {
        if (condensingVoice) return;
        if (!hasReview) {
            Alert.alert('메모가 필요합니다', '먼저 메모를 입력해 주세요.');
            return;
        }

        const { data, error } = await condenseVoice(s.review);
        if (error || !data) return;
        setCondensedVoiceMemo(data);
    };

    const applyCondensedVoiceMemo = (mode) => {
        if (!condensedVoiceMemo) return;
        if (mode === 'replace') {
            Alert.alert('현재 메모를 교체할까요?', '기존 내용은 사라집니다.', [
                { text: '취소', style: 'cancel' },
                {
                    text: '교체',
                    style: 'destructive',
                    onPress: () => {
                        up({ review: condensedVoiceMemo });
                        setSelectedReviewVersion('original');
                        setCondensedVoiceMemo('');
                    },
                },
            ]);
            return;
        }

        const separator = s.review.trim() ? '\n\n[현재 메모 축약]\n' : '';
        up({ review: `${s.review.trim()}${separator}${condensedVoiceMemo}` });
        setSelectedReviewVersion('original');
        setCondensedVoiceMemo('');
    };

    const handleAIResult = useCallback((result) => {
        setAiInsight(result || null);
    }, []);

    const clearAIInsight = useCallback(() => {
        setAiInsight(null);
    }, []);

    if (s.loading) return <ScreenContainer><LoadingSpinner /></ScreenContainer>;

    const theme = isOffMode
        ? { c: DrawerTheme.mutedPurple, bg: DrawerTheme.velvetPurple, placeholder: TextColors.inputPlaceholderOff }
        : { c: DrawerTheme.brightGold, bg: DrawerTheme.walnut, placeholder: TextColors.inputPlaceholderOn };

    return (
        <ScreenContainer>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 50 }]}>
                        <PremiumCard variant="walnut" style={styles.headerCard}>
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                accessibilityRole="button"
                                accessibilityLabel="뒤로가기"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={styles.backButton}
                            >
                                <Text style={styles.backText}>← 뒤로</Text>
                            </TouchableOpacity>
                            <ArchiveTitleHeader
                                eyebrow={isOffMode ? 'PRIVATE DRAWER' : 'DRAWER NOTE'}
                                title={isOffMode ? '개인 서랍 작성' : '기록 수정'}
                                subtitle={isOffMode ? '나만의 메모를 서랍에 보관합니다' : '타로 상담 기록을 정리합니다'}
                                style={styles.archiveTitle}
                            />
                        </PremiumCard>

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
                                onChangeText={(v) => up({ review: v })}
                                placeholder={isOffMode ? '비밀 서랍에 둘 메모를 적어보세요.' : '상담 내용을 기록해 두면 나중에 확인하기 좋습니다.'}
                                placeholderTextColor={theme.placeholder}
                                accessibilityLabel="상담 또는 개인 메모 입력"
                                textAlignVertical="top"
                            />

                            <View style={[styles.buttonRow, styles.voiceRow]}>
                                <CustomButton
                                    title={voiceInputAvailable ? '음성 입력 시작' : '음성 입력 불가'}
                                    onPress={startVoiceInput}
                                    variant={ACTION_VARIANT.SECONDARY}
                                    style={styles.rowButton}
                                    numberOfLines={1}
                                    allowFontScaling={false}
                                    disabled={isBusy}
                                    accessibilityLabel="음성 입력 시작"
                                />
                                <CustomButton
                                    title={condensingVoice ? '축약 중...' : '현재 메모 축약'}
                                    onPress={runVoiceCondense}
                                    loading={condensingVoice}
                                    disabled={!hasReview || s.saving || polishing || condensingVoice}
                                    variant={ACTION_VARIANT.SECONDARY}
                                    style={styles.rowButton}
                                    numberOfLines={1}
                                    allowFontScaling={false}
                                    accessibilityLabel="현재 메모 축약"
                                />
                            </View>
                            <Text style={styles.helperText}>키보드 마이크로 입력한 내용과 직접 작성한 내용을 포함해 현재 메모 칸 전체를 정리합니다.</Text>
                            <Text style={styles.voiceUsageText}>
                                {voiceCondenseRemaining == null ? '이번 달 메모 축약 30회 남음' : `이번 달 메모 축약 ${voiceCondenseRemaining}회 남음`}
                            </Text>
                            {!!voiceCondenseError && <Text style={styles.errorText}>※ {voiceCondenseError}</Text>}
                            {!!condensedVoiceMemo && (
                                <View style={styles.voiceCondensePanel}>
                                    <Text style={styles.voiceCondenseTitle}>현재 메모 축약 결과</Text>
                                    <Text style={styles.voiceCondenseDesc}>원하는 방식으로 기록에 반영하세요.</Text>
                                    <Text style={styles.voiceCondenseText}>{condensedVoiceMemo}</Text>
                                    <View style={styles.panelButtonRow}>
                                        <TouchableOpacity style={styles.versionChip} onPress={() => applyCondensedVoiceMemo('replace')} accessibilityRole="button" accessibilityLabel="축약 결과로 기록 교체">
                                            <Text style={styles.versionChipText}>기록으로 교체</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.versionChip} onPress={() => applyCondensedVoiceMemo('append')} accessibilityRole="button" accessibilityLabel="축약 결과를 아래에 추가">
                                            <Text style={styles.versionChipText}>아래에 추가</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.versionChip} onPress={() => setCondensedVoiceMemo('')} accessibilityRole="button" accessibilityLabel="축약 결과 닫기">
                                            <Text style={styles.versionChipText}>닫기</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            <View style={[styles.polishPanel, { borderColor: `${theme.c}55` }]}>
                                <View style={styles.polishHeaderRow}>
                                    <View style={styles.polishCopy}>
                                        <Text style={[styles.polishTitle, { color: theme.c }]}>AI 문장 다듬기</Text>
                                        <Text style={styles.helperText}>메모의 의미는 유지하고 문장만 자연스럽게 정리합니다.</Text>
                                    </View>
                                    <CustomButton
                                        title={polishing ? '다듬는 중...' : 'AI로 다듬기'}
                                        onPress={runPolish}
                                        loading={polishing}
                                        disabled={!hasReview || s.saving || condensingVoice || polishing}
                                        variant={ACTION_VARIANT.SECONDARY}
                                        style={styles.polishBtn}
                                        numberOfLines={1}
                                        allowFontScaling={false}
                                        accessibilityLabel="AI로 문장 다듬기"
                                    />
                                </View>
                                {!!polishError && <Text style={styles.errorText}>※ {polishError}</Text>}
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
                            </View>
                        </PremiumCard>

                        <PremiumCard style={styles.formCard}>
                            <Text style={styles.sectionLabel}>카드 슬롯</Text>
                            <View style={[styles.imgBox, { borderColor: theme.c }]}>
                                {s.uri ? (
                                    <>
                                        <Image source={{ uri: toDisplayImageUri(s.uri) }} style={styles.fullImg} />
                                        <TouchableOpacity
                                            onPress={() => up({ uri: null })}
                                            style={styles.delBtn}
                                            accessibilityRole="button"
                                            accessibilityLabel="카드 이미지 삭제"
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Text style={styles.whiteText}>×</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <View style={styles.placeholderContainer}>
                                        <Text style={[styles.placeholderText, { color: theme.c }]}>✦</Text>
                                        <Text style={styles.placeholderSubText}>카드를 촬영하거나 선택하세요</Text>
                                    </View>
                                )}
                            </View>

                            <View style={[styles.buttonRow, styles.btnRow]}>
                                <CustomButton
                                    title="촬영"
                                    onPress={() => onPick('cam')}
                                    variant={ACTION_VARIANT.SECONDARY}
                                    style={styles.rowButton}
                                    numberOfLines={1}
                                    allowFontScaling={false}
                                    disabled={isBusy}
                                    accessibilityLabel="카드 이미지 촬영"
                                />
                                <CustomButton
                                    title="앨범 선택"
                                    onPress={() => onPick('lib')}
                                    variant={ACTION_VARIANT.SECONDARY}
                                    style={styles.rowButton}
                                    numberOfLines={1}
                                    allowFontScaling={false}
                                    disabled={isBusy}
                                    accessibilityLabel="앨범에서 카드 이미지 선택"
                                />
                            </View>
                        </PremiumCard>

                        <AISummaryPanel
                            reviewText={effectiveReview}
                            visitDate={s.visit_date}
                            initialResult={aiInsight}
                            onResult={handleAIResult}
                            onClear={clearAIInsight}
                        />

                        <GoldActionButton
                            title={s.saving ? '저장 중...' : (isOffMode ? '개인 서랍에 저장' : '기록 저장')}
                            onPress={onSave}
                            disabled={s.saving || polishing || condensingVoice}
                            style={styles.saveBtn}
                            accessibilityLabel="서랍 기록 저장"
                        />
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { flex: 1 },
    scrollContent: { padding: 18, gap: 14 },
    headerCard: { paddingTop: 12, paddingBottom: 4, backgroundColor: DrawerTheme.walnutDark },
    backButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4, marginBottom: 2 },
    backText: { color: DrawerTheme.mutedIvory, fontWeight: '800', fontSize: 13 },
    archiveTitle: { paddingBottom: 0 },
    formCard: { borderColor: 'rgba(224,184,90,0.24)' },
    sectionLabel: { color: DrawerTheme.brightGold, fontSize: 13, fontWeight: '900', marginBottom: 8, marginLeft: 2, letterSpacing: 0.8 },
    helperText: { color: DrawerTheme.mutedIvory, fontSize: 12, lineHeight: 17, marginBottom: 8, opacity: 0.82 },
    imgBox: { width: '100%', aspectRatio: 3 / 4, maxHeight: 320, backgroundColor: 'rgba(9,0,13,0.62)', borderRadius: 16, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 12, overflow: 'hidden', alignSelf: 'center' },
    fullImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    delBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(74,15,43,0.86)', width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(224,184,90,0.4)' },
    placeholderContainer: { alignItems: 'center', padding: 18 },
    placeholderText: { fontSize: 34, marginBottom: 8 },
    placeholderSubText: { color: DrawerTheme.mutedIvory, fontSize: 13, textAlign: 'center' },
    buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'stretch', minHeight: 50 },
    btnRow: { marginBottom: 0 },
    rowButton: { flex: 1, minWidth: 130, minHeight: 50, alignSelf: 'stretch' },
    titleInput: { backgroundColor: 'rgba(244,232,208,0.07)', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: DrawerTheme.ivory, fontSize: 14, borderWidth: 1, marginBottom: 16 },
    input: { backgroundColor: 'rgba(244,232,208,0.07)', borderRadius: 14, padding: 14, color: DrawerTheme.ivory, minHeight: 150, fontSize: 14, lineHeight: 21, borderWidth: 1 },
    voiceRow: { marginTop: 10, marginBottom: 8 },
    voiceUsageText: { color: DrawerTheme.mutedIvory, fontSize: 12, marginTop: 2, marginLeft: 2, opacity: 0.82 },
    voiceCondensePanel: { marginTop: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', borderRadius: 12, padding: 12, backgroundColor: 'rgba(9,0,13,0.34)' },
    voiceCondenseTitle: { color: DrawerTheme.goldBright, fontWeight: '800', fontSize: 14, marginBottom: 4 },
    voiceCondenseDesc: { color: DrawerTheme.mutedIvory, fontSize: 12, marginBottom: 8 },
    voiceCondenseText: { color: DrawerTheme.ivory, fontSize: 14, lineHeight: 20, marginBottom: 8 },
    whiteText: { color: DrawerTheme.ivory, fontWeight: 'bold', fontSize: 18, lineHeight: 20 },
    saveBtn: { marginTop: 4, minHeight: 54 },
    polishPanel: { marginTop: 12, borderWidth: 1, borderRadius: 14, padding: 12, backgroundColor: 'rgba(9,0,13,0.32)' },
    polishHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    polishCopy: { flex: 1, minWidth: 180 },
    polishTitle: { fontWeight: '900', fontSize: 14, marginBottom: 4 },
    polishBtn: { minWidth: 120, minHeight: 44 },
    errorText: { color: '#ffb4b4', marginTop: 8, fontSize: 12, lineHeight: 17 },
    compareWrap: { marginTop: 10, flexDirection: 'row', gap: 8 },
    panelButtonRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    versionChip: { flex: 1, minWidth: 92, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(244,232,208,0.18)', paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center', backgroundColor: 'rgba(244,232,208,0.05)' },
    versionChipActive: { borderColor: DrawerTheme.goldBright, backgroundColor: 'rgba(212,175,55,0.18)' },
    versionChipText: { color: DrawerTheme.ivory, fontSize: 12, fontWeight: '700' },
});

export default VisitDetailScreen;
