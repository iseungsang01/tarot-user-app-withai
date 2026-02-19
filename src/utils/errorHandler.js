import { ERROR_TYPES, ERROR_MESSAGES } from '../constants/ErrorMessages';

/**
 * 에러 핸들러 유틸리티
 * 통일된 에러 처리 및 사용자 친화적 메시지 제공
 */

/**
 * Supabase 에러 분석 및 변환
 * @param {Error} error - Supabase 에러 객체
 * @returns {object} { type, title, message, icon }
 */
export const parseSupabaseError = (error) => {
  console.error('🔴 [ErrorHandler] Supabase Error:', {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });

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
  const isDev = __DEV__;

  const errorLog = {
    timestamp: new Date().toISOString(),
    context,
    error: {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    },
    ...additionalInfo,
  };

  if (isDev) {
    console.error('========================================');
    console.error('🔴 [ERROR LOG]');
    console.error('📍 Context:', context);
    console.error('⏰ Time:', errorLog.timestamp);
    console.error('❌ Message:', error?.message);
    console.error('🔢 Code:', error?.code);
    console.error('📋 Additional Info:', additionalInfo);
    console.error('📚 Stack:', error?.stack);
    console.error('========================================');
  } else {
    // 프로덕션: 에러 추적 서비스로 전송 (예: Sentry, Firebase Crashlytics)
    // sendToErrorTracking(errorLog);
  }
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
  } = options;

  try {
    const result = await apiCall();

    if (result.error) {
      const errorInfo = parseSupabaseError(result.error);
      logError(context, result.error, additionalInfo);

      if (showAlert && global.showGlobalError) {
        global.showGlobalError(errorInfo);
      }

      if (onError) {
        onError(errorInfo);
      }

      return { data: null, error: result.error, errorInfo };
    }

    return { data: result.data, error: null, errorInfo: null };
  } catch (error) {
    const errorInfo = parseSupabaseError(error);
    logError(context, error, additionalInfo);

    if (showAlert && global.showGlobalError) {
      global.showGlobalError(errorInfo);
    }

    if (onError) {
      onError(errorInfo);
    }

    return { data: null, error, errorInfo };
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
 * 스토리지 에러 생성
 * @param {string} operation - 'SAVE_FAILED' | 'LOAD_FAILED'
 * @returns {object} { type, title, message, icon }
 */
export const createStorageError = (operation) => {
  return {
    type: ERROR_TYPES.STORAGE,
    ...ERROR_MESSAGES[ERROR_TYPES.STORAGE][operation],
  };
};

/**
 * 에러를 Alert로 표시
 * @param {object} errorInfo - 에러 정보 객체
 * @param {import('react-native').Alert} Alert - React Native Alert
 */
export const showErrorAlert = (errorInfo, Alert) => {
  Alert.alert(
    errorInfo.title || '오류',
    errorInfo.message || '알 수 없는 오류가 발생했습니다.',
    [{ text: '확인', style: 'default' }]
  );
};

/**
 * 성공 메시지 표시
 * @param {string} successType - SUCCESS_MESSAGES의 키
 * @param {import('react-native').Alert} Alert - React Native Alert
 * @param {string} customMessage - 커스텀 메시지 (선택)
 */
export const showSuccessAlert = (successType, Alert, customMessage = null) => {
  const { SUCCESS_MESSAGES } = require('../constants/ErrorMessages');
  const successData = SUCCESS_MESSAGES[successType];

  if (!successData) {
    Alert.alert('완료', customMessage || '작업이 완료되었습니다.');
    return;
  }

  Alert.alert(
    successData.title,
    customMessage || successData.message,
    [{ text: '확인', style: 'default' }]
  );
};