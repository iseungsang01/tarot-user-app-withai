import { TERMS_OF_SERVICE } from './terms';
import { PRIVACY_POLICY } from './privacy';

export { APP_OPERATOR, PARTNER_STORE } from './operator';
export { TERMS_OF_SERVICE } from './terms';
export { PRIVACY_POLICY } from './privacy';

/**
 * 동의 버전.
 *
 * 약관이나 처리방침을 고쳐 회원의 동의가 다시 필요해지면 이 값을 올린다.
 * 저장된 동의 기록의 버전이 이 값과 다르면 다시 동의를 받아야 한다.
 */
export const CONSENT_VERSION = '1.0';

export const LEGAL_DOCUMENTS = {
  [TERMS_OF_SERVICE.id]: TERMS_OF_SERVICE,
  [PRIVACY_POLICY.id]: PRIVACY_POLICY,
};

/**
 * 회원가입 동의 항목.
 *
 * 필수 항목을 모두 켜야 가입이 진행된다. documentId 가 있으면 "보기"로 전문을 연다.
 * 마케팅 수신 동의는 지금 앱에 보낼 채널(푸시·문자)이 없어서 넣지 않았다.
 * 채널이 생기면 required: false 항목으로 추가하고 CONSENT_VERSION 을 올린다.
 */
export const CONSENT_ITEMS = [
  {
    key: 'age',
    label: '만 14세 이상입니다',
    required: true,
  },
  {
    key: 'terms',
    label: '서비스 이용약관에 동의합니다',
    required: true,
    documentId: TERMS_OF_SERVICE.id,
  },
  {
    key: 'privacy',
    label: '개인정보 수집·이용에 동의합니다',
    required: true,
    documentId: PRIVACY_POLICY.id,
  },
];

export const REQUIRED_CONSENT_KEYS = CONSENT_ITEMS.filter((item) => item.required).map((item) => item.key);
