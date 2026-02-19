/**
 * Tarot Archive & Note Project Theme
 * 고풍스러운 서재의 서랍장을 모티브로 한 테마 시스템
 */

export const DrawerTheme = {
  // 🪵 [WOOD THEME] - 타로 기록이 있는 서랍 (ON 상태)
  woodLight: '#D2A679',   // 서랍 상단 모서리 하이라이트 (빛받는 부분)
  woodMid: '#8B5A2B',    // 서랍 전면 메인 원목색
  woodDark: '#2A1B12',   // 서랍 사이의 깊은 틈새 및 내부 그림자
  woodFrame: '#4E342E',  // 가구 전체를 감싸는 묵직한 외곽 프레임

  // 🟦 [NAVY THEME] - 일반 메모만 있는 서랍 (OFF 상태)
  navyLight: '#5A6A8E',  // 네이비 서랍 하이라이트
  navyMid: '#3C4E60',   // 네이비 서랍 전면 메인색
  navyDark: '#2A3540',  // 네이비 서랍 깊은 음영

  // ⚜️ [METALIC POINT] - 공통 금속 장식 (손잡이 및 명판)
  goldBrass: '#D4AF37',  // 앤틱 황동 손잡이 메인색
  goldDark: '#B8860B',   // 손잡이 음영 및 테두리 (입체감)
  goldBright: '#FFD700', // ✨ 날짜 텍스트 및 강조 포인트용

  // 🌫️ [EFFECTS] - 그림자 및 오버레이
  shadow: 'rgba(0,0,0,0.6)',
  overlay: 'rgba(0,0,0,0.85)',
  glass: 'rgba(255,255,255,0.1)', // 유리 질감 효과
  
  // 텍스트 색상
  textMain: '#FFFFFF',
  textMuted: '#A0A0A0',
  textDark: '#1A0F0A',
};

export default DrawerTheme;