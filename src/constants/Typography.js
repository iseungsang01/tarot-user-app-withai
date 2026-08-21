import { Platform } from 'react-native';

/**
 * 서체 규칙.
 *
 * 한글에는 장식 서체를 쓰지 않는다. iOS 의 Georgia 에는 한글 글리프가 없어
 * 시스템 산세리프로 폴백되고, 안드로이드의 'serif' 는 본명조(Noto Serif CJK)로
 * 잡힌다. 같은 화면 안에서 어떤 한글은 고딕, 어떤 한글은 명조로 나와
 * "방문 기록 / 개인 기록 / 기록 없음" 같은 라벨만 튀어 보였다.
 *
 * 그래서 장식 서체는 라틴 대문자 제목(DRAWER ARCHIVE 등)에만 남기고,
 * 한글이 한 글자라도 섞이면 OS 기본 서체로 통일한다.
 */
export const Fonts = {
  /**
   * 라틴 전용 장식 서체. 한글 텍스트에는 절대 쓰지 않는다.
   * 한글은 fontFamily 를 아예 지정하지 않아 OS 기본 서체로 통일한다
   * (fontFamily: undefined 로 덮어쓰지 말 것 — 스타일 병합에서 흔들린다).
   */
  display: Platform.OS === 'ios' ? 'Georgia' : 'serif',
};

// 한글 자모 · 호환 자모 · 완성형
const HANGUL_PATTERN = /[ᄀ-ᇿ㄰-㆏가-힣]/;

export const hasHangul = (text) => typeof text === 'string' && HANGUL_PATTERN.test(text);
