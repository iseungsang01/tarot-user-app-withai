import { StyleSheet } from 'react-native';
import { DrawerTheme } from '../constants/DrawerTheme';

/**
 * 설정 계열 폼 컴포넌트 3종이 공유하는 스타일.
 * (SettingPasswordForm · SettingDeleteAccount · SettingReportManager)
 *
 * 화면 껍데기(헤더·스크롤·섹션)는 각 화면이 ArchiveTitleHeader/ScreenContainer 로
 * 처리하므로 여기에는 폼 내부 스타일만 둔다.
 */
export const styles = StyleSheet.create({
  // 입력 폼 카드
  formCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 18,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)'
  },
  formCardDanger: {
    backgroundColor: 'rgba(255, 107, 107, 0.05)',
    borderRadius: 12,
    padding: 18,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)'
  },
  innerTitle: {
    color: DrawerTheme.goldBrass,
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 15
  },

  // 입력 필드
  input: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
    padding: 14,
    color: DrawerTheme.ivory,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  textArea: {
    minHeight: 100,
    marginTop: 10,
    textAlignVertical: 'top'
  },
  inputDanger: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
    padding: 14,
    color: DrawerTheme.ivory,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)'
  },

  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.1)',
    marginVertical: 20
  },

  // 접수 내역 리스트
  historyCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  historyType: {
    fontSize: 11,
    color: DrawerTheme.mutedIvory
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold'
  },
  historyTitle: {
    color: DrawerTheme.ivory,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6
  },
  historyDate: {
    fontSize: 11,
    color: DrawerTheme.mutedIvory,
    opacity: 0.72
  },
  emptyText: {
    color: DrawerTheme.mutedIvory,
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 20,
    opacity: 0.82
  },

  // 관리자 답변 박스
  adminResponseBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.2)',
  },
  adminResponseLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: DrawerTheme.goldBrass,
    marginBottom: 6,
  },
  adminResponseText: {
    fontSize: 13,
    color: DrawerTheme.ivory,
    lineHeight: 20,
    opacity: 0.92,
  },

  uploadButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.08)'
  },
  uploadButtonText: {
    color: DrawerTheme.goldBrass,
    fontWeight: '700',
    fontSize: 13
  },
  previewImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 280,
    borderRadius: 10,
    marginTop: 10,
  },
  detailText: {
    marginTop: 8,
    color: DrawerTheme.goldBrass,
    fontSize: 12,
    fontWeight: '700'
  },
});
