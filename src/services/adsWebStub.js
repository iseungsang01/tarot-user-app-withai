/**
 * 웹 번들용 빈 AdMob 모듈.
 *
 * AdMob 에는 웹 SDK 가 없고 rewardedAdService 는 웹에서 광고 경로를 아예 타지 않는다.
 * 그런데 Metro 는 require 를 정적으로 따라가기 때문에, 런타임에 닿지도 않는
 * 네이티브 전용 모듈 때문에 웹 번들이 통째로 실패한다. metro.config.js 에서
 * 웹 플랫폼에 한해 이 파일로 갈아끼운다.
 */
export default null;
