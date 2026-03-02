import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
} from 'react-native';
import { CustomButton } from './CustomButton';
import { formatDateOnly } from '../utils/formatters';
import { Colors } from '../constants/Colors';
import { DrawerTheme } from '../constants/DrawerTheme';

/**
 * 서랍장 카드 컴포넌트
 * @param {object} visit - 방문 기록 데이터 (is_manual 포함)
 */
export const DrawerCard = ({ visit, index, isOpen, onToggle, onSelectCard, onDelete }) => {
  const [animatedHeight] = useState(new Animated.Value(isOpen ? 1 : 0));
  
  // HistoryScreen에서 주입한 is_manual 여부 (true: 개인메모, false: 서버기록)
  const isManual = visit.is_manual;

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: isOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isOpen]);

  const contentHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 520], // 내용물 높이 최댓값
  });

  return (
    <View style={[styles.drawerContainer, { zIndex: 100 - index }]}>
      {/* --- 서랍 손잡이 (Header) --- */}
      <TouchableOpacity
        style={[
          styles.drawerHandle,
          isOpen && styles.drawerHandleOpen,
          // ✅ 개인 메모(Manual)일 때 네이비 테마 적용
          isManual && { backgroundColor: '#10171E', borderColor: DrawerTheme.navyLight }
        ]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.handleContent}>
          <View style={styles.handleLeft}>
            <Text style={styles.handleIcon}>{isManual ? '✒️' : '🗂️'}</Text>
            <Text style={[
              styles.handleDate, 
              isManual && { color: DrawerTheme.navyLight }
            ]}>
              {formatDateOnly(visit.visit_date)}
            </Text>
          </View>
          <View style={styles.handleRight}>
            {visit.card_image && <Text style={styles.handleBadge}>📸</Text>}
            {visit.card_review && <Text style={styles.handleBadge}>📝</Text>}
            <Text style={[styles.handleArrow, isManual && { color: DrawerTheme.navyLight }]}>
              {isOpen ? '▲' : '▼'}
            </Text>
          </View>
        </View>

        {/* 손잡이 장식 (Knobs) */}
        <View style={styles.handleDecoration}>
          <View style={[styles.handleKnob, isManual && { backgroundColor: DrawerTheme.navyLight }]} />
          <View style={[styles.handleKnob, isManual && { backgroundColor: DrawerTheme.navyLight }]} />
        </View>
      </TouchableOpacity>

      {/* --- 서랍 내용물 (Body) --- */}
      <Animated.View
        style={[
          styles.drawerContent,
          {
            maxHeight: contentHeight,
            opacity: animatedHeight,
          },
          isManual && { backgroundColor: '#1A2530', borderColor: DrawerTheme.navyLight }
        ]}
      >
        <View style={styles.contentInner}>
          {/* 액션 버튼 영역 */}
          <View style={styles.actions}>
            {visit.card_image || visit.card_review ? (
              <TouchableOpacity
                style={[styles.editButton, isManual && { borderColor: DrawerTheme.navyLight, backgroundColor: 'rgba(74, 90, 126, 0.2)' }]}
                onPress={() => onSelectCard(visit.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.editButtonText, isManual && { color: DrawerTheme.navyLight }]}>
                  {isManual ? '✏️ 메모 수정' : '✏️ 기록 수정'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.addButton, isManual && { borderColor: DrawerTheme.navyLight }]}
                onPress={() => onSelectCard(visit.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.addButtonText, isManual && { color: DrawerTheme.navyLight }]}>+ 기록 추가</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.deleteButton}
              // ✅ HistoryScreen의 handleDeleteVisit 규격에 맞게 ID만 전달
              onPress={() => onDelete(visit.id)}
            >
              <Text style={styles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>

          {/* 사진 및 리뷰 렌더링 */}
          {visit.card_image || visit.card_review ? (
            <View style={styles.cardDisplay}>
              {visit.card_image && (
                <View style={[styles.imageContainer, isManual && { borderColor: DrawerTheme.navyLight }]}>
                  <Image 
                    source={{ uri: visit.card_image }} 
                    style={styles.cardImage}
                    resizeMode="cover"
                  />
                </View>
              )}

              {visit.card_review && (
                <View style={[styles.reviewBox, isManual && { backgroundColor: 'rgba(74, 90, 126, 0.1)', borderColor: DrawerTheme.navyLight }]}>
                  <View style={styles.reviewHeader}>
                    <Text style={[styles.reviewLabel, isManual && { color: DrawerTheme.navyLight }]}>
                      {isManual ? '✒️ 비밀 메모' : '📝 상담 기록'}
                    </Text>
                  </View>
                  <Text style={styles.reviewText} numberOfLines={4}>
                    {visit.card_review}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            /* 기록이 없는 경우 */
            <View style={styles.noCard}>
              <Text style={styles.noCardIcon}>{isManual ? '✒️' : '📝'}</Text>
              <Text style={[styles.noCardText, isManual && { color: DrawerTheme.navyLight }]}>
                아직 내용을 작성하지 않았습니다.
              </Text>
              <CustomButton
                title="기록하기"
                onPress={() => onSelectCard(visit.id)}
                style={[styles.selectButton, isManual && { backgroundColor: DrawerTheme.navyMid }]}
              />
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  drawerContainer: { marginBottom: 12, position: 'relative' },
  drawerHandle: {
    backgroundColor: Colors.purpleMid,
    borderWidth: 3,
    borderColor: Colors.purpleLight,
    borderRadius: 15,
    padding: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  drawerHandleOpen: {
    borderColor: Colors.gold,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  handleContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  handleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  handleIcon: { fontSize: 24 },
  handleDate: { fontSize: 18, fontWeight: '700', color: Colors.gold },
  handleRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  handleBadge: { fontSize: 16 },
  handleArrow: { fontSize: 14, color: Colors.lavender, fontWeight: '700' },
  handleDecoration: { flexDirection: 'row', justifyContent: 'center', gap: 50, marginTop: 8 },
  handleKnob: { width: 35, height: 7, backgroundColor: Colors.purpleLight, borderRadius: 4 },
  drawerContent: {
    backgroundColor: Colors.purpleMid,
    borderWidth: 3,
    borderColor: Colors.gold,
    borderTopWidth: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  contentInner: { padding: 18 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  addButton: { borderWidth: 1.5, borderColor: Colors.purpleLight, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  addButtonText: { fontSize: 13, fontWeight: '700', color: Colors.gold },
  editButton: { borderWidth: 1.5, borderColor: Colors.gold, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  editButtonText: { fontSize: 13, fontWeight: '700', color: Colors.gold },
  deleteButton: { backgroundColor: 'rgba(255, 107, 107, 0.15)', borderRadius: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  deleteButtonText: { fontSize: 18 },
  cardDisplay: { gap: 12 },
  imageContainer: { borderWidth: 2, borderColor: Colors.purpleLight, borderRadius: 12, overflow: 'hidden' },
  cardImage: { width: '100%', height: 200 },
  reviewBox: { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderWidth: 1, borderColor: Colors.purpleLight, borderRadius: 10, padding: 12 },
  reviewHeader: { marginBottom: 5 },
  reviewLabel: { fontSize: 12, fontWeight: '700', color: Colors.lavender },
  reviewText: { fontSize: 14, color: '#EEE', lineHeight: 20 },
  noCard: { alignItems: 'center', padding: 20 },
  noCardIcon: { fontSize: 40, marginBottom: 10, opacity: 0.5 },
  noCardText: { fontSize: 14, color: Colors.lavender, marginBottom: 15 },
  selectButton: { paddingHorizontal: 20, height: 40 },
});