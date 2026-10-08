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

// 서버 validate_password_complexity 와 같은 규칙(매니저 7차): 6자 이상, UTF-8 72바이트 이하
// (bcrypt 가 그 뒤를 버린다), '123456' 금지(매니저 초기 비밀번호였다).
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_BYTES = 72;
const FORBIDDEN_PASSWORDS = new Set(['123456']);

const utf8ByteLength = (text) => new TextEncoder().encode(text).length;

export const getPasswordValidationMessage = (password) => {
  // 서버는 char_length(코드포인트)로 센다. 이모지는 UTF-16 길이로 2라 그대로 세면 어긋난다.
  if (typeof password !== 'string' || Array.from(password).length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  }
  if (utf8ByteLength(password) > MAX_PASSWORD_BYTES) return '비밀번호가 너무 깁니다.';
  if (FORBIDDEN_PASSWORDS.has(password)) return '너무 쉬운 비밀번호입니다. 다른 비밀번호를 써 주세요.';
  return null;
};

export const validatePassword = (password) => getPasswordValidationMessage(password) === null;

/**
 * 비밀번호 변경 폼 입력값 검증
 * 재설정 화면과 강제 변경 화면이 공유한다.
 *
 * @param {object} fields - { currentPassword, newPassword, confirmPassword }
 * @returns {string|null} 문제가 있으면 사용자에게 보여줄 메시지, 없으면 null
 */
export const validatePasswordChange = ({ currentPassword, newPassword, confirmPassword }) => {
  if (!currentPassword || !newPassword || !confirmPassword) return '모든 필드를 입력해 주세요.';
  if (!validatePassword(newPassword)) return getPasswordValidationMessage(newPassword);
  if (newPassword !== confirmPassword) return '새 비밀번호 확인이 일치하지 않습니다.';
  return null;
};
