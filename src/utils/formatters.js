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
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  } else {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  }
};

/**
 * 날짜 포맷팅 (날짜만, 시간 제외)
 * ISO 문자열을 한국어 형식으로 변환
 * 
 * @param {string} dateStr - ISO 날짜 문자열
 * @returns {string} 포맷된 날짜
 * 
 * @example
 * formatDateOnly('2024-12-25T10:30:00') // '2024년 12월 25일'
 */
export const formatDateOnly = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월${day}일`;
};