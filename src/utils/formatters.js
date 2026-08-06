/**
 * 포맷팅 유틸리티 함수
 * 날짜, 전화번호 등 데이터 포맷팅
 */

/**
 * 전화번호 포맷팅 (통일: 010-1234-5678)
 * 숫자만 입력받아 010-1234-5678 형식으로 변환
 * 
 * @param {string} value - 입력된 전화번호 (숫자 또는 하이픈 포함)
 * @returns {string} 포맷된 전화번호 (010-1234-5678)
 * 
 * @example
 * formatPhoneNumber('01012345678')     // '010-1234-5678'
 * formatPhoneNumber('010-1234-5678')   // '010-1234-5678'
 * formatPhoneNumber('010123')          // '010-123'
 * formatPhoneNumber('0101234')         // '010-1234'
 */
export const formatPhoneNumber = (value) => {
  // 1. 숫자만 추출
  const numbers = value.replace(/[^0-9]/g, '');

  // 2. 길이에 따라 포맷팅
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
};

/**
 * 날짜 포맷팅 (짧은 형식)
 * ISO 문자열을 '12월25일' 형식으로 변환
 * 
 * @param {string} dateStr - ISO 날짜 문자열
 * @returns {string} 포맷된 날짜
 * 
 * @example
 * formatDateShort('2024-12-25T10:30:00') // '12월25일'
 */
export const formatDateShort = (dateStr) => {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월${date.getDate()}일`;
};

/**
 * 날짜 포맷팅 (점 구분 형식)
 * 목록 카드에서 쓰는 짧은 표기
 *
 * @param {string} dateStr - ISO 날짜 문자열
 * @param {string} [fallback=''] - 날짜가 없을 때 표시할 문구
 * @returns {string} 포맷된 날짜
 *
 * @example
 * formatDateDot('2024-12-25T10:30:00')        // '24.12.25'
 * formatDateDot(null, '마감 없음')             // '마감 없음'
 */
export const formatDateDot = (dateStr, fallback = '') => {
  if (!dateStr) return fallback;
  const date = new Date(dateStr);
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
};
