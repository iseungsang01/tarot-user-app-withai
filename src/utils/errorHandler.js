import { ERROR_TYPES, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants/ErrorMessages';
import { errorEmitter } from './errorEmitter';

import { dialog } from './dialog';
/**
 * 에러 핸들러 유틸리티
 * 통일된 에러 처리 및 사용자 친화적 메시지 제공
 */

/**
 * Supabase 에러 분석 및 변환
 * @param {Error} error - Supabase 에러 객체
 * @returns {object} { type, title, message, icon }
 */
const parseSupabaseError = (error) => {
  // 로깅은 logError 한 곳에서만 한다 (여기서도 찍으면 한 건이 두 번 남는다)

  // 네트워크 에러
  if (!error || error.message?.includes('Failed to fetch') || error.message?.includes('Network')) {
    return {
      type: ERROR_TYPES.NETWORK,
      ...ERROR_MESSAGES[ERROR_TYPES.NETWORK],
    };
  }

  // 인증 에러
  if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
    return {
      type: ERROR_TYPES.AUTH,
      ...ERROR_MESSAGES[ERROR_TYPES.AUTH].SESSION_EXPIRED,
    };
  }

  // 데이터 없음
  if (error.code === 'PGRST116') {
    return {
      type: ERROR_TYPES.NOT_FOUND,
      ...ERROR_MESSAGES[ERROR_TYPES.NOT_FOUND],
    };
  }

  // 서버 에러 (500번대)
  if (error.code?.startsWith('5') || error.message?.includes('server')) {
    return {
      type: ERROR_TYPES.SERVER,
      ...ERROR_MESSAGES[ERROR_TYPES.SERVER],
    };
  }

  // 기타 에러
  return {
    type: ERROR_TYPES.UNKNOWN,
    title: ERROR_MESSAGES[ERROR_TYPES.UNKNOWN].title,
    message: error.message || ERROR_MESSAGES[ERROR_TYPES.UNKNOWN].message,
    icon: ERROR_MESSAGES[ERROR_TYPES.UNKNOWN].icon,
  };
};

/**
 * 에러 로깅 (개발/프로덕션 분리)
 * @param {string} context - 에러 발생 위치 (예: 'LoginScreen', 'visitService')
 * @param {Error} error - 에러 객체
 * @param {object} additionalInfo - 추가 정보
 */
export const logError = (context, error, additionalInfo = {}) => {
  if (!__DEV__) {
    // 프로덕션: 에러 추적 서비스로 전송 (예: Sentry, Firebase Crashlytics)
    return;
  }

  // 한 건의 에러는 한 줄로 남긴다. 나눠 찍으면 LogBox 에 그만큼 쌓인다
  console.error(`[${context}] ${error?.message || '알 수 없는 오류'}`, {
    code: error?.code,
    ...additionalInfo,
    stack: error?.stack,
  });
};

/**
 * API 호출 에러 핸들러
 * @param {string} context - 호출 위치
 * @param {Function} apiCall - API 호출 함수
 * @param {object} options - 옵션
 * @returns {object} { data, error, errorInfo }
 */
export const handleApiCall = async (context, apiCall, options = {}) => {
  const {
    showAlert = false,
    onError = null,
    additionalInfo = {},
    silentErrorCodes = [],
  } = options;

  // 호출이 { error }를 돌려준 경우와 예외를 던진 경우를 같은 방식으로 보고한다
  const report = (error) => {
    const errorInfo = parseSupabaseError(error);

    if (!silentErrorCodes.includes(error?.code)) logError(context, error, additionalInfo);
    if (showAlert) errorEmitter.emit(errorInfo);
    if (onError) onError(errorInfo);

    return errorInfo;
  };

  try {
    const result = await apiCall();

    if (result.error) return { data: null, error: result.error, errorInfo: report(result.error) };

    return { data: result.data, error: null, errorInfo: null };
  } catch (error) {
    return { data: null, error, errorInfo: report(error) };
  }
};

/**
 * 유효성 검사 에러 생성
 * @param {string} errorKey - ERROR_MESSAGES.VALIDATION의 키
 * @returns {object} { type, title, message, icon }
 */
export const createValidationError = (errorKey) => {
  const errorData = ERROR_MESSAGES[ERROR_TYPES.VALIDATION][errorKey];

  if (!errorData) {
    return {
      type: ERROR_TYPES.VALIDATION,
      ...ERROR_MESSAGES[ERROR_TYPES.VALIDATION].REQUIRED_FIELD,
    };
  }

  return {
    type: ERROR_TYPES.VALIDATION,
    ...errorData,
  };
};

/**
 * 권한 에러 생성
 * @param {string} permission - 'CAMERA' | 'GALLERY'
 * @returns {object} { type, title, message, icon }
 */
export const createPermissionError = (permission) => {
  return {
    type: ERROR_TYPES.PERMISSION,
    ...ERROR_MESSAGES[ERROR_TYPES.PERMISSION][permission],
  };
};


/**
 * 에러를 앱 다이얼로그로 표시
 * @param {object} errorInfo - 에러 정보 객체
 * @returns {Promise<void>} 사용자가 닫으면 resolve
 */
export const showErrorAlert = (errorInfo) => {
  return dialog.alert(
    errorInfo.title || '오류',
    errorInfo.message || '알 수 없는 오류가 발생했습니다.',
    [{ text: '확인', style: 'default' }]
  );
};

/**
 * 성공 메시지 표시
 * @param {string} successType - SUCCESS_MESSAGES의 키
 * @param {string} customMessage - 커스텀 메시지 (선택)
 * @returns {Promise<void>} 사용자가 닫으면 resolve.
 *   화면 전환은 이걸 await 한 뒤에 해야 안내와 화면이 따로 놀지 않는다.
 */
export const showSuccessAlert = (successType, customMessage = null) => {
  const successData = SUCCESS_MESSAGES[successType];

  if (!successData) {
    return dialog.alert('완료', customMessage || '작업이 완료되었습니다.');
  }

  return dialog.alert(
    successData.title,
    customMessage || successData.message,
    [{ text: '확인', style: 'default' }]
  );
};
