/** 앱 설정 상수 */

import Constants from 'expo-constants';

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

/**
 * 매장 정보.
 *
 * 앱 곳곳의 "매장에 문의해주세요" 안내가 실제로 닿을 곳이 필요해서 둔다.
 * 지도 링크는 nmap:// 스킴 대신 웹 URL 을 쓴다 — 네이버 지도 앱이 있으면
 * 앱으로 열리고, 없으면 브라우저로 떨어져서 어느 쪽이든 실패하지 않는다.
 *
 * 예약은 캐치테이블로 보낸다. 매장이 인스타 프로필에서 권하는 경로이기도 하다.
 *
 * 2026-08-07 에 한 번 네이버 예약으로 뺐던 적이 있다. 실기기(SM-A516N/Android 13)에서
 * app.catchtable.co.kr 이 `pm get-app-links` Selection state 에서 Disabled 라 Chrome 으로
 * 떨어졌는데, 그 웹 페이지가 20초를 기다려도 아무것도 그리지 않았기 때문이다.
 * 2026-09-11 에 같은 URL 을 다시 열어보니 매장명·사진·영업시간·예약 버튼까지 정상
 * 렌더링된다. 캐치테이블이 웹 폴백을 고친 것으로 보여 되돌린다.
 * 브라우저로 떨어지는 동작 자체는 그대로이므로, 저쪽 페이지가 다시 비면 같은 증상이
 * 재발한다. 예약 링크가 흰 화면이라는 제보가 들어오면 여기를 먼저 의심할 것.
 *
 * intent:// 로 앱을 직접 여는 방법은 쓸 수 없다 — RN Linking.openURL 이 intent 스킴을
 * 파싱하지 못해 폴백 Alert 만 뜬다.
 *
 * 길찾기(mapUrl)는 네이버 지도 그대로 둔다. 앱·웹 양쪽에서 확실히 열린다.
 *
 * 영업시간 출처: 월 휴무·일요일 낮 시간은 매장 인스타, 18:00~24:00 은 캐치테이블
 * 매장 페이지. **일요일 12:00~16:00 은 2026-08-30 까지의 한시 운영**이라 그 이후에는
 * 다시 확인해야 한다.
 *
 * phone 은 아직 확정하지 못해 비워둔다(네이버·캐치테이블 모두 번호를 텍스트로
 * 노출하지 않는다). 채우면 StoreContactCard 가 전화 버튼을 자동으로 붙인다.
 */
export const STORE_INFO = {
  name: '타로와인바 서랍',
  reservationUrl: 'https://app.catchtable.co.kr/ct/shop/a_hidden_drawer',
  mapUrl: 'https://map.naver.com/p/entry/place/1998657810',
  phone: '',
  address: '서울 관악구 청룡1길 19, 3층 301호 (서울대입구역 4번 출구에서 475m)',
  hours: '월 휴무 · 화~토 18:00~24:00 · 일 12:00~16:00',
};

