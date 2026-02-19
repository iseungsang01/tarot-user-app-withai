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
export const validatePhoneNumber = (phone) => {
  return /^010-\d{4}-\d{4}$/.test(phone);
};

/**
 * 빈 문자열 검증
 * 공백만 있는 경우도 빈 문자열로 판단
 * 
 * @param {string} text - 검증할 문자열
 * @returns {boolean} 비어있으면 true
 * 
 * @example
 * isEmpty('') // true
 * isEmpty('   ') // true
 * isEmpty('text') // false
 */
export const isEmpty = (text) => {
  return !text || text.trim().length === 0;
};