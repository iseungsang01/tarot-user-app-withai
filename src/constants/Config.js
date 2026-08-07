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
 * 예약은 캐치테이블(app.catchtable.co.kr)이 아니라 네이버 예약으로 보낸다.
 * 실기기(SM-A516N, Android 13) 검증 결과 캐치테이블 링크는 흰 화면으로 끝났다 —
 * 앱이 설치돼 있어도 `pm get-app-links` 상 app.catchtable.co.kr 이 Disabled 라
 * 링크가 Chrome 으로 떨어지고, 그 웹 페이지는 렌더링되지 않는다. 링크 열기 설정은
 * 기기마다 다르므로 손님 상당수가 같은 흰 화면을 본다.
 * 네이버 경로는 앱·웹 양쪽에서 동작하는 것을 실기기에서 확인했다.
 *
 * phone/hours 는 아직 확정하지 못해 비워둔다(네이버에 노출되는 건 "18:00 영업 시작"
 * 뿐이고 종료 시각·휴무일은 확인 못 했다). 값이 채워지면 StoreContactCard 가
 * 해당 줄과 전화 버튼을 자동으로 노출한다.
 */
export const STORE_INFO = {
  name: '타로와인바 서랍',
  reservationUrl: 'https://map.naver.com/p/entry/place/1998657810?placePath=%2Fbooking',
  mapUrl: 'https://map.naver.com/p/entry/place/1998657810',
  phone: '',
  address: '서울 관악구 청룡1길 19, 3층 301호 (서울대입구역 4번 출구에서 475m)',
  hours: '',
};

