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

const MIN_PASSWORD_LENGTH = 6;

export const validatePassword = (password) => (
  typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH
);

export const getPasswordValidationMessage = () => `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;

/**
 * 비밀번호 변경 폼 입력값 검증
 * 재설정 화면과 강제 변경 화면이 공유한다.
 *
 * @param {object} fields - { currentPassword, newPassword, confirmPassword }
 * @returns {string|null} 문제가 있으면 사용자에게 보여줄 메시지, 없으면 null
 */
export const validatePasswordChange = ({ currentPassword, newPassword, confirmPassword }) => {
  if (!currentPassword || !newPassword || !confirmPassword) return '모든 필드를 입력해 주세요.';
  if (!validatePassword(newPassword)) return getPasswordValidationMessage();
  if (newPassword !== confirmPassword) return '새 비밀번호 확인이 일치하지 않습니다.';
  return null;
};
