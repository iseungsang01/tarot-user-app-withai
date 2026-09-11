import { Platform } from 'react-native';

/**
 * 서체 규칙.
 *
 * 한글 본문은 나눔스퀘어라운드로 통일한다. OS 기본 서체(애플 SD 산돌고딕 / 로보토)는
 * 기기마다 인상이 달라지고 모서리가 각져서, 서랍 톤과 맞는 둥근 고딕을 직접 실어둔다.
 *
 * 장식 서체(Georgia / serif)는 여전히 라틴 대문자 제목(DRAWER ARCHIVE 등)에만 쓴다.
 * iOS 의 Georgia 에는 한글 글리프가 없어 시스템 산세리프로 폴백되고 안드로이드의
 * 'serif' 는 본명조로 잡혀서, 한글이 한 글자라도 섞이면 같은 화면에서 서체가 튄다.
 */
export const Fonts = {
  /** 라틴 전용 장식 서체. 한글 텍스트에는 절대 쓰지 않는다. */
  display: Platform.OS === 'ios' ? 'Georgia' : 'serif',

  /** 한글 본문 서체. 굵기별로 별도 패밀리로 올려 둔다(런타임 로딩은 굵기 매칭을 못 한다). */
  body: 'NanumSquareRound',
  bodyBold: 'NanumSquareRoundBold',
  bodyExtraBold: 'NanumSquareRoundExtraBold',
};

/** App 진입점에서 useFonts 로 올리는 목록. */
export const FONT_ASSETS = {
  [Fonts.body]: require('../../assets/fonts/NanumSquareRound.ttf'),
  [Fonts.bodyBold]: require('../../assets/fonts/NanumSquareRoundB.ttf'),
  [Fonts.bodyExtraBold]: require('../../assets/fonts/NanumSquareRoundEB.ttf'),
};

const EXTRA_BOLD = new Set(['800', '900', 'black', 'heavy']);
const BOLD = new Set(['600', '700', 'bold', 'semibold']);

/**
 * fontWeight 를 본문 서체 패밀리로 옮긴다.
 *
 * 굵은 패밀리를 골랐으면 fontWeight 는 반드시 지워야 한다. 남겨 두면 이미 굵은
 * 글리프 위에 OS 가 가짜 볼드를 덧칠해 한 단계 더 두꺼워진다.
 */
export const resolveBodyFont = (fontWeight) => {
  const weight = String(fontWeight ?? '').toLowerCase();
  if (EXTRA_BOLD.has(weight)) return { fontFamily: Fonts.bodyExtraBold, fontWeight: undefined };
  if (BOLD.has(weight)) return { fontFamily: Fonts.bodyBold, fontWeight: undefined };
  return { fontFamily: Fonts.body, fontWeight: undefined };
};

// 한글 자모 · 호환 자모 · 완성형
const HANGUL_PATTERN = /[ᄀ-ᇿ㄰-㆏가-힣]/;

export const hasHangul = (text) => typeof text === 'string' && HANGUL_PATTERN.test(text);
