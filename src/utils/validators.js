/**
 * 검증 유틸리티 함수
 * 입력값 유효성 검사
 */

/**
 * 전화번호 검증 (통일: 010-1234-5678)
 * 010-1234-5678 형식 확인
 * 
 * @param {string} phone - 전화번호
 * @returns {boolean} 유효 여부
 * 
 * @example
 * validatePhoneNumber('010-1234-5678') // true
 * validatePhoneNumber('010-123-4567')  // false
 * validatePhoneNumber('01012345678')   // false (하이픈 필수)
 */
export const validatePhoneNumber = (phone) => /^010-\d{4}-\d{4}$/.test(phone);

export const MIN_PASSWORD_LENGTH = 6;

export const validatePassword = (password) => (
  typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH
);

export const getPasswordValidationMessage = () => `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
