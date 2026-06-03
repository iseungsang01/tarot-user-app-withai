/** 앱 설정 상수 */

import Constants from 'expo-constants';

const runtimeVersion =
  Constants.expoConfig?.version ||
  Constants.manifest2?.extra?.expoClient?.version ||
  Constants.manifest?.version ||
  '1.0.5';

export const APP_INFO = {
  name: 'drawer',
  version: runtimeVersion,
  description: '타로 카드 선택 및 스탬프 적립 앱',
};

export const ERROR_MESSAGES = {
  network: '네트워크 연결을 확인해주세요.',
  server: '서버 오류가 발생했습니다.',
  unknown: '알 수 없는 오류가 발생했습니다.',
  notFound: '데이터를 찾을 수 없습니다.',
  unauthorized: '권한이 없습니다.',
  validation: '입력값을 확인해주세요.',
};

export const STORAGE_KEYS = {
  COACH_MARKS: 'has_seen_main_coach_marks_v1',
};
