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
 * phone/address/hours 는 아직 확인되지 않아 비워둔다. 값이 채워지면
 * StoreContactCard 가 해당 줄을 자동으로 노출한다.
 */
export const STORE_INFO = {
  name: '타로와인바 서랍',
  reservationUrl: 'https://app.catchtable.co.kr/ct/shop/a_hidden_drawer',
  mapUrl: 'https://map.naver.com/p/entry/place/1998657810',
  phone: '',
  address: '',
  hours: '',
};

