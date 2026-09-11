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
 * 영업시간 (2026-09-11 캐치테이블 예약 캘린더로 재확인):
 * 월요일은 예약 캘린더에 계속 휴무로 뜬다. 일요일 낮 12:00~16:00 한시 운영은 끝났다 —
 * 9월 13일(일) 예약 가능 시간이 17:40 부터라 낮 영업이 아니다. 평일과 같은 저녁 영업으로
 * 보고 화~일 로 합쳤다.
 *
 * 다만 일요일 마감 시각은 직접 확인한 값이 아니다. 캐치테이블은 영업시간 표를 노출하지
 * 않고, 예약 슬롯은 마감 4시간 전에 끊긴다(수요일 18:00~20:00 / 영업 18:00~24:00).
 * 일요일도 마지막 슬롯이 20:00 으로 같아서 24:00 마감으로 적었다. 매장에 확인되면 고칠 것.
 * 일요일 첫 슬롯이 17:40 이라 실제 오픈은 조금 이를 수 있다.
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
  hours: '월 휴무 · 화~일 18:00~24:00',
};

