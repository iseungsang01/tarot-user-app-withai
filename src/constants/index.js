import Constants from 'expo-constants';

/**
 * 🎨 Colors & Gradients
 */
export const Colors = {
    purpleDark: '#1a0033',
    purpleMid: '#2d004d',
    purpleLight: '#8a2be2',
    purpleLighter: '#9370db',
    gold: '#ffd700',
    lavender: '#e0b0ff',
    red: '#ff4500',
    redSoft: '#ff6b6b',
    errorRed: '#f44336',
    green: '#4caf50',
};

export const Gradients = {
    purple: ['#1a0033', '#2d004d'],
    button: ['#8a2be2', '#9370db'],
    goldBrown: ['#D4A679', '#B8860B'],
    red: ['#ff6b6b', '#ee5a6f'],
};

/**
 * 🗄️ Drawer Theme
 */
export const DrawerTheme = {
    woodLight: '#D2A679',
    woodMid: '#8B5A2B',
    woodDark: '#2A1B12',
    woodFrame: '#4E342E',
    navyLight: '#5A6A8E',
    navyMid: '#3C4E60',
    navyDark: '#2A3540',
    goldBrass: '#D4AF37',
    goldDark: '#B8860B',
    goldBright: '#FFD700',
    shadow: 'rgba(0,0,0,0.6)',
    overlay: 'rgba(0,0,0,0.85)',
    glass: 'rgba(255,255,255,0.1)',
    textMain: '#FFFFFF',
    textMuted: '#A0A0A0',
    textDark: '#1A0F0A',
};

/**
 * ⚙️ Config
 */
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

export const STAMP_CONFIG = {
    maxStamps: 10,
    stampsPerVisit: 1,
    couponReward: 1,
};

/**
 * 🛑 Error & Success Messages
 */
export const ERROR_TYPES = {
    NETWORK: 'NETWORK',
    AUTH: 'AUTH',
    VALIDATION: 'VALIDATION',
    SERVER: 'SERVER',
    NOT_FOUND: 'NOT_FOUND',
    PERMISSION: 'PERMISSION',
    UNKNOWN: 'UNKNOWN',
    STORAGE: 'STORAGE',
};

export const ERROR_MESSAGES = {
    [ERROR_TYPES.NETWORK]: { title: '네트워크 오류', message: '인터넷 연결을 확인해주세요.', icon: '📡' },
    [ERROR_TYPES.AUTH]: {
        LOGIN_FAILED: { title: '로그인 실패', message: '전화번호 또는 비밀번호를 확인해주세요.', icon: '🔐' },
        NOT_REGISTERED: { title: '미등록 번호', message: '등록되지 않은 전화번호입니다.', icon: '❌' },
        WRONG_PASSWORD: { title: '비밀번호 오류', message: '비밀번호가 올바르지 않습니다.', icon: '🔑' },
        SESSION_EXPIRED: { title: '세션 만료', message: '다시 로그인해주세요.', icon: '⏰' },
    },
    [ERROR_TYPES.VALIDATION]: {
        PHONE_INVALID: { title: '전화번호 오류', message: '올바른 전화번호를 입력해주세요. (010-1234-5678)', icon: '📱' },
        PASSWORD_EMPTY: { title: '비밀번호 누락', message: '비밀번호를 입력해주세요.', icon: '🔒' },
        REQUIRED_FIELD: { title: '필수 입력', message: '필수 항목을 입력해주세요.', icon: '✏️' },
        REVIEW_TOO_LONG: { title: '리뷰 길이 초과', message: '리뷰는 5000자 이내로 작성해주세요.', icon: '📝' },
    },
    [ERROR_TYPES.SERVER]: { title: '서버 오류', message: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.', icon: '🔧' },
    [ERROR_TYPES.NOT_FOUND]: { title: '데이터 없음', message: '요청하신 데이터를 찾을 수 없습니다.', icon: '🔍' },
    [ERROR_TYPES.PERMISSION]: {
        CAMERA: { title: '카메라 권한 필요', message: '카메라 권한을 허용해주세요.', icon: '📷' },
        GALLERY: { title: '갤러리 권한 필요', message: '갤러리 권한을 허용해주세요.', icon: '🖼️' },
    },
    [ERROR_TYPES.STORAGE]: {
        SAVE_FAILED: { title: '저장 실패', message: '데이터 저장 중 오류가 발생했습니다.', icon: '💾' },
        LOAD_FAILED: { title: '불러오기 실패', message: '데이터를 불러오는 중 오류가 발생했습니다.', icon: '📥' },
    },
    [ERROR_TYPES.UNKNOWN]: { title: '오류 발생', message: '알 수 없는 오류가 발생했습니다.', icon: '⚠️' },
};

export const SUCCESS_MESSAGES = {
    LOGIN: { title: '로그인 성공', message: '환영합니다!', icon: '✅' },
    SAVE: { title: '저장 완료', message: '✨ 저장되었습니다!', icon: '💾' },
    UPDATE: { title: '수정 완료', message: '✅ 수정되었습니다!', icon: '✏️' },
    DELETE: { title: '삭제 완료', message: '🗑️ 삭제되었습니다.', icon: '🗑️' },
    VOTE: { title: '투표 완료', message: '✅ 투표가 완료되었습니다!', icon: '🗳️' },
    COUPON_USED: { title: '쿠폰 사용', message: '✅ 쿠폰이 사용되었습니다!', icon: '🎟️' },
};
