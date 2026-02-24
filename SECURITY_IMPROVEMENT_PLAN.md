# 보안 개선 요약 및 변경 가이드

이 문서는 현재 앱(`tarot-user-app-withai`) 기준으로 **어디를 어떻게 바꾸면 보안이 좋아지는지**를 빠르게 적용할 수 있도록 정리한 실행 가이드입니다.

## 1) 가장 시급한 문제: AI API 키 클라이언트 노출

현재 앱은 OpenAI/Google API 키를 `EXPO_PUBLIC_*` 환경변수로 읽어서 모바일 앱에서 직접 호출합니다.

- 위치: `src/services/openaiService.js`
- 문제:
  - 앱 번들/네트워크 분석으로 키 노출 위험
  - 키 탈취 시 비용 폭증 및 악성 사용 가능

### 변경 방향

**클라이언트에서 외부 AI API를 직접 호출하지 않고**, Supabase Edge Function(또는 별도 백엔드)으로 프록시합니다.

### 코드 변경 포인트

1. `src/services/openaiService.js`
   - 제거/축소: `EXPO_PUBLIC_OPENAI_API_KEY`, `EXPO_PUBLIC_GOOGLE_API_KEY` 직접 사용
   - 추가: `supabase.functions.invoke('ai-chat', { body: ... })` 형태 호출

2. 백엔드(Edge Function)
   - 서버 환경변수로만 AI API 키 보관
   - 요청당 사용자 인증 확인 + 사용량 제한(Rate Limit)
   - 로깅 시 프롬프트/개인정보 마스킹

3. 앱 환경변수
   - `EXPO_PUBLIC_OPENAI_API_KEY`, `EXPO_PUBLIC_GOOGLE_API_KEY` 제거
   - 클라이언트에는 백엔드 URL/공개키만 유지

---

## 2) 인증/비밀번호 정책 강화

### 현재 리스크

- 로그인 하단 문구에 “초기 비밀번호는 1234”가 노출됨
- 비밀번호를 RPC 파라미터로 전달하는 구조 사용 중

### 변경 방향

1. `src/screens/LoginScreen.js`
   - 초기 비밀번호 고정 문구 제거
   - 비밀번호 분실 시 재설정 플로우(문자 인증/관리자 승인) 안내로 교체

2. `src/services/authService.js` + DB RPC
   - 서버에서 반드시 bcrypt/argon2 해시 비교
   - 로그인 실패 횟수 기반 지연/잠금 적용
   - IP/디바이스별 rate limit 적용
   - 비밀번호 정책(길이/복잡도) 강화

3. 최초 로그인 강제 변경
   - `customers` 테이블에 `must_change_password` 필드 추가
   - 로그인 성공 후 해당 플래그가 true면 즉시 비밀번호 변경 화면으로 이동

---

## 3) 민감정보/운영 로그 정리

### 현재 리스크

- `console.log`가 서비스/화면에 다수 남아 있어 운영 중 정보 노출 가능

### 변경 방향

1. 전역 로거 유틸 추가 (`src/utils/logger.js`)
   - `debug/info/warn/error` 수준 분리
   - production 빌드에서는 `debug/info` 비활성화

2. 변경 대상 예시
   - `src/services/couponService.js`의 상세 로그
   - `src/context/AuthContext.js`의 게스트 로그인 디버그 로그

3. 에러 수집 도구 연동
   - Sentry 등으로 비식별 에러만 전송
   - 전화번호/토큰/비밀번호 등은 절대 전송 금지

---

## 4) 세션/권한 통제 강화

### 점검 포인트

- 현재 Supabase client에서 `persistSession: false`로 되어 있어 모바일 UX 기준 재로그인 빈도가 높아질 수 있음
- 보안/UX 균형 관점에서 정책 재검토 필요

### 변경 방향

1. 인증 모델 정리
   - 가능하면 Supabase Auth 기반 토큰 세션 사용
   - 커스텀 RPC 로그인 유지 시에도 서버 토큰/만료/재발급 정책 명확화

2. 데이터 접근 제어
   - DB Row Level Security(RLS) 정책 전수 점검
   - 고객 본인 데이터만 조회 가능하도록 최소권한 원칙 적용

---

## 5) 빠르게 실행 가능한 체크리스트 (우선순위)

### P0 (즉시)

- [ ] AI 키를 클라이언트에서 제거하고 Edge Function 프록시로 이전
- [ ] 로그인 화면의 “초기 비밀번호 1234” 문구 제거
- [ ] 운영 로그에서 민감한 디버그 출력 제거

### P1 (1~2주)

- [ ] 로그인 rate limit/잠금/지연 정책 적용
- [ ] 최초 로그인 강제 비밀번호 변경
- [ ] 비밀번호 복구 플로우 구축

### P2 (2~4주)

- [ ] RLS 정책 점검 및 테스트 자동화
- [ ] 보안 점검 CI(정적분석 + 의존성 취약점 스캔)

---

## 6) 파일별 변경 가이드 요약

- `src/services/openaiService.js`
  - 외부 AI 직접 호출 삭제/축소
  - 백엔드 함수 호출 방식으로 대체
- `src/screens/LoginScreen.js`
  - 초기 비밀번호 고정 문구 제거
- `src/services/authService.js`
  - 로그인/회원가입 RPC 호출은 유지 가능하나, 서버 측 정책 강화 필수
- `src/context/AuthContext.js`, `src/services/couponService.js`
  - 디버그 로그 제거 및 로거 유틸로 통일
- `src/services/supabase.js`
  - 세션 정책을 보안/UX 기준으로 재검토

---

## 7) 실제 적용 순서 추천

1. AI 프록시 백엔드 먼저 구축 (키 노출 차단)
2. 로그인 문구/정책 수정 (초기 비밀번호 제거)
3. 서버 rate limit + 잠금 정책 적용
4. 로그 정리 및 에러 모니터링 도입
5. RLS/보안 테스트 자동화

이 순서대로 진행하면 **짧은 시간에 실제 위험도를 크게 낮출 수 있습니다**.
