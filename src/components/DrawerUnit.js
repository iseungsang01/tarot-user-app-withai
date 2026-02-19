import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { DrawerTheme } from '../constants/DrawerTheme';

/**
 * 서랍 정면(Unit) 컴포넌트
 * @param {object} visit - 방문 기록 데이터 (is_manual 필드 포함)
 * @param {function} onSelectCard - 클릭 시 호출될 함수
 * @param {function} onLongPress - 롱프레스 시 호출될 함수
 * @param {boolean} selectionMode - 다중 선택 모드 여부
 * @param {boolean} isSelected - 현재 선택된 상태
 */
export const DrawerUnit = ({ visit, onSelectCard, onLongPress, selectionMode, isSelected }) => {
  // is_manual: false(서버기록) -> Wood 테마
  // is_manual: true(개인메모) -> Navy 테마
  const isManualMode = visit.is_manual === true;
  const isOnMode = !isManualMode;

  // 작성 여부 판단 (내용이나 이미지가 있으면 작성된 서랍)
  const isWritten = !!(visit.card_review && visit.card_review.trim()) || !!visit.card_image;

  // 테마 설정 분기
  const theme = {
    mid: isOnMode ? DrawerTheme.woodMid : DrawerTheme.navyMid,
    light: isOnMode ? DrawerTheme.woodLight : DrawerTheme.navyLight,
    dark: isOnMode ? DrawerTheme.woodDark : DrawerTheme.navyDark,
  };

  // 날짜 포맷 (예: 2026.01.12)
  const displayDate = visit.visit_date ?
    visit.visit_date.split('T')[0].split('-').map(Number).join('.') : '';

  return (
    <View style={[styles.drawerWrapper, { borderBottomColor: DrawerTheme.woodDark }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onSelectCard(visit)}
        onLongPress={onLongPress}
        delayLongPress={500}
        style={[
          styles.drawerFront,
          { backgroundColor: theme.mid, borderTopColor: theme.light },
          // 서버 기록(Wood)인데 아직 내용을 적지 않았다면 약간 투명하게 처리
          (isOnMode && !isWritten) && { opacity: 0.7 },
          // ✅ 선택된 상태일 때 강조 효과
          isSelected && styles.selectedDrawer
        ]}
      >
        <View style={styles.bezel}>
          {/* ✅ 선택 모드일 때 체크박스 표시 */}
          {selectionMode && (
            <View style={styles.checkboxContainer}>
              <View style={[
                styles.checkbox,
                isSelected && styles.checkboxActive
              ]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </View>
          )}

          {/* 날짜 표시: 모든 서랍의 공통 요소 */}
          <Text style={[styles.dateText, { color: DrawerTheme.goldBright }]}>{displayDate}</Text>

          {/* 인디케이터: 서버 기록(Wood)이면서 미작성일 때만 'EMPTY' 표시 */}
          {isOnMode && !isWritten && !selectionMode && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>EMPTY</Text>
            </View>
          )}

          {/* 개인 메모(Navy)일 때는 펜 아이콘 인디케이터 추가 */}
          {isManualMode && !selectionMode && (
            <View style={styles.statusBadge}>
              <Text style={[styles.statusText, { color: DrawerTheme.navyLight }]}>PRIVATE</Text>
            </View>
          )}

          {/* 공통 황동 손잡이 디자인 */}
          {!selectionMode && (
            <View style={styles.knobSystem}>
              <View style={[styles.knobPlate, { backgroundColor: theme.dark, opacity: 0.5 }]} />
              <View style={[styles.knobHandle, { backgroundColor: DrawerTheme.goldBrass, borderColor: DrawerTheme.goldDark }]} />
            </View>
          )}

          {/* ✅ 선택 모드일 때는 선택 표시 */}
          {selectionMode && (
            <View style={styles.selectionIndicator}>
              <Text style={styles.selectionText}>{isSelected ? '선택됨' : '탭하여 선택'}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  drawerWrapper: {
    borderBottomWidth: 3
  },
  drawerFront: {
    height: 100,
    padding: 8,
    borderTopWidth: 1.5,
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.3)'
  },
  // ✅ 선택된 서랍 강조 효과
  selectedDrawer: {
    borderWidth: 2,
    borderColor: DrawerTheme.goldBrass,
    shadowColor: DrawerTheme.goldBrass,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  bezel: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center'
  },
  dateText: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    left: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  statusText: {
    color: '#AAA',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1
  },
  knobSystem: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15
  },
  knobPlate: {
    width: 34,
    height: 6,
    borderRadius: 1,
    position: 'absolute'
  },
  knobHandle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2
  },

  // ✅ 체크박스 스타일
  checkboxContainer: {
    position: 'absolute',
    top: 10,
    left: 12,
    zIndex: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    borderColor: DrawerTheme.goldBrass,
    backgroundColor: DrawerTheme.goldBrass,
  },
  checkmark: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
  },

  // ✅ 선택 인디케이터
  selectionIndicator: {
    marginTop: 10,
  },
  selectionText: {
    fontSize: 11,
    color: '#AAA',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});