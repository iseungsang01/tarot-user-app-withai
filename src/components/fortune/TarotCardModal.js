import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DrawerTheme } from '../../constants/DrawerTheme';
import { ArchiveTitleHeader, GoldActionButton } from '../common/PremiumUI';
import { toDisplayImageUri } from '../../utils/imageUri';
import { useCondenseVoiceMemo } from '../../hooks/useAI';

import { dialog } from '../../utils/dialog';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const TarotCardModal = ({ isVisible, visit, onClose, onEdit, onDelete, onApplyCondensedMemo }) => {
  const [condensedMemo, setCondensedMemo] = useState('');
  const {
    loading: condensing,
    error: condenseError,
    remaining: condenseRemaining,
    condense,
  } = useCondenseVoiceMemo();

  useEffect(() => {
    if (isVisible) setCondensedMemo('');
  }, [isVisible, visit?.id]);

  if (!visit) return null;

  const isManual = visit.is_manual;
  const displayDate = visit.visit_date
    ? visit.visit_date.split('T')[0].split('-').map(Number).join('.')
    : '';
  const imageUri = toDisplayImageUri(visit.card_image);
  const title = visit.title?.trim() ? visit.title : `${displayDate}의 기록`;
  const hasReview = !!visit.card_review?.trim();

  const handleCondense = async () => {
    if (condensing) return;
    if (!hasReview) {
      dialog.alert('메모가 필요합니다', '축약할 기록 내용이 없습니다.');
      return;
    }

    const { data, error } = await condense(visit.card_review);
    if (error || !data) return;
    setCondensedMemo(data);
  };

  const applyCondensed = (mode) => {
    if (!condensedMemo) return;

    const apply = async () => {
      const current = visit.card_review?.trim() || '';
      const nextReview = mode === 'replace'
        ? condensedMemo
        : `${current}${current ? '\n\n[메모 축약]\n' : ''}${condensedMemo}`;
      await onApplyCondensedMemo?.(visit, nextReview);
      setCondensedMemo('');
    };

    if (mode === 'replace') {
      dialog.alert('현재 기록을 축약본으로 교체할까요?', '기존 메모 내용은 축약본으로 바뀝니다.', [
        { text: '취소', style: 'cancel' },
        { text: '교체', style: 'destructive', onPress: apply },
      ]);
      return;
    }

    apply();
  };

  const handleDeletePress = () => {
    dialog.alert(
      '기록 삭제',
      isManual
        ? '이 개인 서랍 기록을 정말 삭제하시겠습니까?'
        : '이 상담 기록을 정말 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          // 모달을 닫는 것도, 완료 안내를 띄우는 시점도 목록 화면이 잡는다.
          // 여기서 임의의 지연을 두면 삭제와 화면이 따로 논다.
          onPress: () => onDelete(visit.id),
        },
      ],
    );
  };

  return (
    <Modal visible={isVisible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.touchableOutside}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="기록 상세 닫기"
        />

        <LinearGradient
          colors={isManual
            ? [DrawerTheme.bgDeepPurple, DrawerTheme.velvetPurple, DrawerTheme.bgBlackCherry]
            : [DrawerTheme.walnut, DrawerTheme.walnutDark, DrawerTheme.bgBlackCherry]}
          style={styles.modalContent}
        >
          <View style={styles.brassLip} />
          <View style={styles.modalHandle} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <ArchiveTitleHeader
                  eyebrow={isManual ? 'PRIVATE DRAWER NOTE' : 'TAROT ARCHIVE NOTE'}
                  title={title}
                  subtitle={isManual ? '개인 서랍에 보관된 메모' : '상담 서랍에 보관된 기록'}
                  style={styles.archiveHeader}
                />
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <Text style={styles.closeIcon}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.datePill}>{displayDate || '날짜 없음'}</Text>
              <Text style={[styles.sourceTag, isManual && styles.manualSourceTag]}>
                {isManual ? 'OFF · 개인 서랍' : 'ON · 타로 아카이브'}
              </Text>
            </View>

            {imageUri && (
              <View style={styles.cardContainer}>
                <LinearGradient
                  colors={[DrawerTheme.brassHighlight, DrawerTheme.brass, DrawerTheme.darkGold]}
                  style={styles.goldFrame}
                >
                  <View style={styles.imageWalnutFrame}>
                    <Image source={{ uri: imageUri }} style={styles.tarotImage} resizeMode="cover" />
                  </View>
                </LinearGradient>
              </View>
            )}

            {visit.ai_insight?.summary && (
              <View style={styles.reviewSection}>
                <Text style={styles.sectionLabel}>AI 분석 노트</Text>
                <View style={[styles.reviewContent, styles.aiContent]}>
                  <Text style={styles.reviewText}>{visit.ai_insight.summary}</Text>
                </View>
              </View>
            )}

            <View style={styles.reviewSection}>
              <Text style={styles.sectionLabel}>{isManual ? '개인 서랍 메모' : '타로 기록'}</Text>
              <View style={[styles.reviewContent, !imageUri && styles.fullHeightReview]}>
                <Text style={styles.reviewText}>{visit.card_review || '기록된 내용이 없습니다.'}</Text>
              </View>
            </View>

            <View style={styles.actionArea}>
              <GoldActionButton
                title="기록 수정하기"
                onPress={() => onEdit(visit.id)}
                style={styles.primaryButton}
              />

              <TouchableOpacity
                style={[styles.condenseButton, (!hasReview || condensing) && styles.disabled]}
                onPress={handleCondense}
                disabled={!hasReview || condensing}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="메모 축약"
              >
                <Text style={styles.condenseButtonText}>{condensing ? '메모 축약 중...' : '메모 축약'}</Text>
                <Text style={styles.condenseUsageText}>
                  {condenseRemaining == null ? '이번 달 30회 남음' : `이번 달 ${condenseRemaining}회 남음`}
                </Text>
              </TouchableOpacity>

              {!!condenseError && <Text style={styles.errorText}>※ {condenseError}</Text>}
              {!!condensedMemo && (
                <View style={styles.condensePanel}>
                  <Text style={styles.condensePanelTitle}>메모 축약 결과</Text>
                  <Text style={styles.condensePanelText}>{condensedMemo}</Text>
                  <View style={styles.condenseActions}>
                    <TouchableOpacity style={styles.condenseChip} onPress={() => applyCondensed('replace')} accessibilityRole="button" accessibilityLabel="축약 결과로 기록 교체">
                      <Text style={styles.condenseChipText}>기록으로 교체</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.condenseChip} onPress={() => applyCondensed('append')} accessibilityRole="button" accessibilityLabel="축약 결과를 기록 아래에 추가">
                      <Text style={styles.condenseChipText}>아래에 추가</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.condenseChip} onPress={() => setCondensedMemo('')} accessibilityRole="button" accessibilityLabel="축약 결과 닫기">
                      <Text style={styles.condenseChipText}>닫기</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleDeletePress}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="이 기록 삭제"
              >
                <Text style={styles.secondaryButtonText}>이 기록 삭제</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(9,0,13,0.88)',
    justifyContent: 'flex-end',
  },
  touchableOutside: { flex: 1 },
  modalContent: {
    height: SCREEN_HEIGHT * 0.86,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(224,184,90,0.48)',
    paddingHorizontal: 22,
    paddingTop: 12,
    shadowColor: DrawerTheme.shadow,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 18,
  },
  brassLip: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 2,
    backgroundColor: DrawerTheme.brassHighlight,
    opacity: 0.7,
  },
  modalHandle: {
    width: 58,
    height: 7,
    backgroundColor: DrawerTheme.brass,
    borderRadius: 4,
    alignSelf: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: DrawerTheme.brassHighlight,
  },
  scrollContent: { paddingBottom: 50 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  headerCopy: { flex: 1, minWidth: 0 },
  archiveHeader: { paddingBottom: 0 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,232,208,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(224,184,90,0.25)',
    marginLeft: 8,
  },
  closeIcon: { fontSize: 28, lineHeight: 30, color: DrawerTheme.brightGold, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
  datePill: {
    color: DrawerTheme.mutedIvory,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(9,0,13,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(200,163,64,0.22)',
  },
  sourceTag: {
    color: DrawerTheme.brightGold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(184,135,53,0.18)',
  },
  manualSourceTag: { color: DrawerTheme.mutedPurple, backgroundColor: 'rgba(142,122,154,0.16)' },
  cardContainer: { alignItems: 'center', marginBottom: 26 },
  goldFrame: {
    padding: 3,
    borderRadius: 16,
    shadowColor: DrawerTheme.brassHighlight,
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 10,
  },
  imageWalnutFrame: {
    padding: 9,
    backgroundColor: DrawerTheme.walnutDark,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(244,232,208,0.1)',
  },
  tarotImage: { width: SCREEN_HEIGHT * 0.29, aspectRatio: 3 / 4, maxHeight: SCREEN_HEIGHT * 0.43, borderRadius: 8 },
  reviewSection: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 15,
    color: DrawerTheme.brightGold,
    marginBottom: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  reviewContent: {
    backgroundColor: 'rgba(244,232,208,0.08)',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: 'rgba(200,163,64,0.24)',
    borderLeftColor: DrawerTheme.brassHighlight,
  },
  aiContent: { backgroundColor: 'rgba(74,15,43,0.24)' },
  fullHeightReview: { minHeight: 200 },
  reviewText: { fontSize: 15, color: DrawerTheme.ivory, lineHeight: 25 },
  actionArea: { gap: 14 },
  primaryButton: { minHeight: 54 },
  condenseButton: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.38)',
    backgroundColor: 'rgba(184,135,53,0.16)',
  },
  condenseButtonText: { color: DrawerTheme.brightGold, fontSize: 14, fontWeight: '900' },
  condenseUsageText: { color: DrawerTheme.mutedIvory, fontSize: 11, fontWeight: '700', marginTop: 3, opacity: 0.82 },
  condensePanel: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: 14,
    padding: 13,
    backgroundColor: 'rgba(9,0,13,0.36)',
  },
  condensePanelTitle: { color: DrawerTheme.goldBright, fontSize: 14, fontWeight: '900', marginBottom: 8 },
  condensePanelText: { color: DrawerTheme.ivory, fontSize: 14, lineHeight: 22 },
  condenseActions: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  condenseChip: {
    flex: 1,
    minWidth: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(244,232,208,0.18)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(244,232,208,0.05)',
  },
  condenseChipText: { color: DrawerTheme.ivory, fontSize: 12, fontWeight: '800' },
  errorText: { color: '#ffb4b4', fontSize: 12, lineHeight: 17 },
  disabled: { opacity: 0.5 },
  secondaryButton: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(224,184,90,0.24)',
    backgroundColor: 'rgba(18,0,8,0.34)',
  },
  secondaryButtonText: { color: DrawerTheme.mutedIvory, fontSize: 14, fontWeight: '800' },
});
