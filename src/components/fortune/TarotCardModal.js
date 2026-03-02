import React from 'react';
import {View, Text, StyleSheet, Modal, Image, TouchableOpacity,
  ScrollView, Dimensions, Alert, Platform,
} from 'react-native';
import { DrawerTheme } from '../constants/DrawerTheme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const TarotCardModal = ({ isVisible, visit, onClose, onEdit, onDelete }) => {
  if (!visit) return null;

  const isManual = visit.is_manual;

  const displayDate = visit.visit_date ? 
    visit.visit_date.split('T')[0].split('-').map(Number).join('.') : '';

  /**
   * ✅ 삭제 처리 수정: visitId만 전달
   */
  const handleDeletePress = () => {
    Alert.alert(
      "기록 삭제",
      isManual 
        ? "이 개인 메모 서랍을 정말 비우시겠습니까?" 
        : "이 상담 기록을 정말 삭제하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        { 
          text: "삭제", 
          style: "destructive", 
          onPress: () => {
            console.log('🗑️ [TarotCardModal] 삭제 버튼 클릭:', visit.id);
            onClose(); 
            // 모달 닫힘 애니메이션 후 삭제 로직 실행 (UI 꼬임 방지)
            setTimeout(() => { 
              console.log('🗑️ [TarotCardModal] onDelete 호출:', visit.id);
              onDelete(visit.id); // ✅ visitId만 전달
            }, 300);
          }
        }
      ]
    );
  };

  return (
    <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.touchableOutside} activeOpacity={1} onPress={onClose} />
        
        <View style={[
          styles.modalContent, 
          isManual && { backgroundColor: '#10171E', borderColor: DrawerTheme.navyLight }
        ]}>
          <View style={[styles.modalHandle, isManual && { backgroundColor: '#1A2530' }]} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <View>
                <Text style={[styles.dateTitle, isManual && { color: DrawerTheme.navyLight }]}>
                  {displayDate}의 기록
                </Text>
                <Text style={[styles.sourceTag, { color: isManual ? DrawerTheme.navyLight : DrawerTheme.woodLight }]}>
                  {isManual ? '📝 개인 메모장' : '🏛 타로 아카이브'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={[styles.closeIcon, isManual && { color: DrawerTheme.navyLight }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {visit.card_image && (
              <View style={styles.cardContainer}>
                <View style={[styles.goldFrame, isManual && { borderColor: DrawerTheme.navyLight, shadowColor: '#000' }]}>
                  <Image
                    source={{ uri: visit.card_image }} 
                    style={styles.tarotImage} 
                    resizeMode="contain" 
                  />
                </View>
              </View>
            )}

            <View style={styles.reviewSection}>
              <Text style={[styles.sectionLabel, isManual && { color: DrawerTheme.navyLight }]}>
                {isManual ? '✒️ 비밀 서랍' : '📜 타로 노트'}
              </Text>
              <View style={[
                styles.reviewContent, 
                !visit.card_image && styles.fullHeightReview,
                isManual && { backgroundColor: 'rgba(74, 90, 126, 0.1)', borderLeftColor: DrawerTheme.navyLight }
              ]}>
                <Text style={styles.reviewText}>
                  {visit.card_review || "기록된 내용이 없습니다."}
                </Text>
              </View>
            </View>

            <View style={styles.actionArea}>
              <TouchableOpacity 
                style={[styles.primaryButton, isManual && { backgroundColor: DrawerTheme.navyMid }]} 
                onPress={() => { onEdit(visit.id); onClose(); }}
              >
                <Text style={[styles.primaryButtonText, isManual && { color: '#FFF' }]}>기록 수정하기</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={handleDeletePress}>
                <Text style={[
                  styles.secondaryButtonText, 
                  isManual && { color: '#555', textDecorationColor: '#555' }
                ]}>
                  🗑️ 이 서랍 비우기(삭제)
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'flex-end' },
  touchableOutside: { flex: 1 },
  modalContent: {
    height: SCREEN_HEIGHT * 0.85,
    backgroundColor: '#1A0F0A',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 2,
    borderColor: '#3E2723',
    paddingHorizontal: 25,
    paddingTop: 15,
  },
  modalHandle: { width: 45, height: 5, backgroundColor: '#3E2723', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  scrollContent: { paddingBottom: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 },
  dateTitle: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#FFD700', 
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif' 
  },
  sourceTag: { fontSize: 12, marginTop: 4, fontWeight: '600', letterSpacing: 0.5 },
  closeIcon: { fontSize: 24, color: '#D4AF37' },
  closeBtn: { padding: 5 },
  cardContainer: { alignItems: 'center', marginBottom: 30 },
  goldFrame: {
    padding: 8, backgroundColor: '#000', borderRadius: 10,
    borderWidth: 2, borderColor: '#D4AF37',
    shadowColor: '#FFD700', shadowOpacity: 0.3, shadowRadius: 15, elevation: 10,
  },
  tarotImage: { width: SCREEN_HEIGHT * 0.28, height: SCREEN_HEIGHT * 0.45, borderRadius: 5 },
  reviewSection: { marginBottom: 35 },
  sectionLabel: { fontSize: 16, color: '#D4AF37', marginBottom: 12, fontWeight: 'bold' },
  reviewContent: { 
    backgroundColor: 'rgba(93, 64, 55, 0.2)', 
    padding: 22, 
    borderRadius: 15, 
    borderLeftWidth: 4, 
    borderLeftColor: '#D4AF37' 
  },
  fullHeightReview: { minHeight: 200 },
  reviewText: { fontSize: 16, color: '#E0E0E0', lineHeight: 28 },
  actionArea: { gap: 15 },
  primaryButton: { 
    backgroundColor: '#D4AF37', 
    paddingVertical: 16, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  primaryButtonText: { color: '#1A0F0A', fontSize: 17, fontWeight: 'bold' },
  secondaryButton: { paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { color: '#8B4513', fontSize: 14, textDecorationLine: 'underline' },
});