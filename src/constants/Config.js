/** 앱 설정 상수 */

export const APP_INFO = {
  name: 'drawer',
  version: '1.0.4',
  description: '타로 카드 선택 및 스탬프 적립 앱',
};

export const STAMP_CONFIG = {
  maxStamps: 10,
  stampsPerVisit: 1,
  couponReward: 1,
};

export const ERROR_MESSAGES = {
  network: '네트워크 연결을 확인해주세요.',
  server: '서버 오류가 발생했습니다.',
  unknown: '알 수 없는 오류가 발생했습니다.',
  notFound: '데이터를 찾을 수 없습니다.',
  unauthorized: '권한이 없습니다.',
  validation: '입력값을 확인해주세요.',
};

export const SUCCESS_MESSAGES = {
  login: '✅ 로그인 성공!',
  logout: '로그아웃 되었습니다.',
  save: '✨ 저장되었습니다!',
  update: '✅ 수정되었습니다!',
  delete: '🗑️ 삭제되었습니다.',
  submit: '✅ 접수되었습니다!',
  vote: '✅ 투표가 완료되었습니다!',
  couponUsed: '✅ 쿠폰이 사용되었습니다!',
};