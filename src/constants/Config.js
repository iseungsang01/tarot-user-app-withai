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
 * 예약을 캐치테이블이 아니라 네이버로 보내는 이유 (실기기 SM-A516N/Android 13 검증):
 * 매장은 인스타 프로필에서 캐치테이블 예약을 권장하지만, 링크가 앱으로 가지 못하면
 * 손님이 흰 화면을 본다. app.catchtable.co.kr 은 도메인이 verified 인데도
 * `pm get-app-links` 의 Selection state 에서 Disabled 라 Chrome 으로 떨어졌고,
 * 그 페이지는 20초를 기다려도 아무것도 그리지 않았다. 링크 열기 설정은 기기마다
 * 달라서 캐치테이블 앱이 없는 손님은 전부 이 화면을 보게 된다.
 * 패키지를 지정해 앱을 직접 여는 intent:// URI 도 시도했으나 RN Linking.openURL 이
 * intent 스킴을 파싱하지 않아 실패한다(폴백 Alert 만 뜬다).
 * 네이버는 앱·웹 양쪽에서 동작하고 이 매장은 N예약도 받는다.
 * 캐치테이블로 되돌리려면 앱 미설치 손님이 흰 화면을 본다는 점을 감수해야 한다.
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
  reservationUrl: 'https://map.naver.com/p/entry/place/1998657810?placePath=%2Fbooking',
  mapUrl: 'https://map.naver.com/p/entry/place/1998657810',
  phone: '',
  address: '서울 관악구 청룡1길 19, 3층 301호 (서울대입구역 4번 출구에서 475m)',
  hours: '월 휴무 · 화~토 18:00~24:00 · 일 12:00~16:00',
};

