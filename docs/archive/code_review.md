# 🔮 타로 셀라 — 전체 코드 리뷰 보고서

> **프로젝트**: tarot-user-app-withai (React Native / Expo + Supabase)
> **리뷰 일시**: 2026-05-29
> **분석 범위**: 서비스, 컨텍스트, 화면, 컴포넌트, 네비게이션, 훅, 유틸리티, DB 스키마, Edge Functions, 설정 파일 전체

---

## 📊 요약 대시보드

| 심각도 | 건수 | 설명 |
|--------|------|------|
| 🔴 **Critical** | **4건** | 즉시 수정 필요 — 보안/데이터 무결성 위험 |
| 🟡 **Warning** | **31건** | 개선 권장 — 품질/유지보수성/성능 이슈 |
| 🟢 **Good** | **24건** | 잘 구현된 패턴 |

---

## 🔴 Critical Issues (즉시 수정 필요)

### 1. Supabase 클라이언트 이중화 — 세션 동기화 위험

> [!CAUTION]
> 두 개의 독립적인 Supabase 클라이언트 인스턴스가 존재하여 **세션 불일치**, **토큰 갱신 충돌**, **인증 상태 불일치**가 발생할 수 있습니다.

| 파일 | 사용처 |
|------|--------|
| [supabase.js](file:///c:/tarot-user-app-withai/src/services/supabase.js) | authService, visitService, voteService, couponService, noticeService, customerService, adminService |
| [supabaseClient.js](file:///c:/tarot-user-app-withai/src/services/supabaseClient.js) | aiService, aiUsageService |

두 파일 모두 `createClient()`를 호출하여 **별도의 싱글턴 인스턴스**를 생성합니다. 설정은 동일하지만 서로 다른 auth 세션을 유지합니다.

**권장 조치**: `supabaseClient.js`를 삭제하고 `supabase.js` 하나로 통합

---

### 2. 프로덕션 URL 하드코딩 — 보안 취약점

> [!CAUTION]
> [supabaseClient.js](file:///c:/tarot-user-app-withai/src/services/supabaseClient.js)에 프로덕션 Supabase URL이 폴백 값으로 하드코딩되어 있습니다.

```js
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL 
  || process.env.SUPABASE_URL 
  || 'https://ifyoulnzixonemxmlmxj.supabase.co'; // ← 하드코딩된 프로덕션 URL
```

환경 변수 로딩이 실패하면 이 폴백이 사용되며, 소스 코드에 프로덕션 인프라 정보가 노출됩니다.

**권장 조치**: 폴백 URL 제거, 환경 변수 필수 검증 (`Config.js` 패턴 적용)

---

### 3. 파일 줄바꿈 문자 혼용

> [!WARNING]
> 프로젝트 전체에 `\r\n` (Windows)과 `\n` (Unix) 줄바꿈 문자가 혼재되어 있습니다. 같은 파일 내에서도 혼용되는 경우가 있습니다.

**영향**: Git diff 노이즈, 코드 리뷰 어려움, 일부 도구의 오동작 가능

**권장 조치**:
1. `.editorconfig` 추가하여 `end_of_line = lf` 설정
2. `.gitattributes`에 `* text=auto eol=lf` 설정
3. 기존 파일 일괄 변환: `git add --renormalize .`

---

### 4. 데이터 보존 정책 부재

> [!WARNING]
> [schema.sql](file:///c:/tarot-user-app-withai/supabase/schema.sql)에 데이터 정리/퍼지 메커니즘이 없습니다. readings, visits, vote_responses 등의 테이블이 무한히 증가합니다.

**권장 조치**: 
- 오래된 데이터 아카이빙 정책 수립
- Supabase cron job 또는 Edge Function으로 자동 정리 구현
- 파티셔닝 또는 TTL 기반 정리 도입

---

## 🟡 Warning Issues (개선 권장)

### 아키텍처 & 설계

| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| 1 | 환경 변수 이중 정의 | [.env](file:///c:/tarot-user-app-withai/.env) | `EXPO_PUBLIC_` 접두사 유/무 버전이 중복 정의 |
| 2 | TypeScript 미사용 | [tsconfig.json](file:///c:/tarot-user-app-withai/tsconfig.json) | TS 설정이 있지만 모든 소스가 `.js` — 설정 제거하거나 마이그레이션 필요 |
| 3 | 모놀리식 네비게이터 | [MainNavigator.js](file:///c:/tarot-user-app-withai/src/navigation/MainNavigator.js) | 12,675B — 커스텀 탭바, 여러 스택 네비게이터가 하나의 파일에 집중 |
| 4 | 비일관적 export 패턴 | 컴포넌트 전반 | `export default function`, `export default class`, named export 혼용 |

---

### 보안 & 인증

| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| 5 | `ensureSession()` 레이스 컨디션 | [authService.js](file:///c:/tarot-user-app-withai/src/services/authService.js) | 동시 호출 시 다수의 익명 세션 생성 가능 — 뮤텍스/잠금 패턴 필요 |
| 6 | 클라이언트 사이드 관리자 확인 | [adminService.js](file:///c:/tarot-user-app-withai/src/services/adminService.js) | `isAdmin()` 체크를 클라이언트에서 수행 — RLS 정책으로 서버사이드 강제 필요 |
| 7 | 소프트 삭제 미완성 | [authService.js](file:///c:/tarot-user-app-withai/src/services/authService.js) | `deleteAccountPermanently()`가 상태만 변경하고 실제 Auth 유저 미삭제 (GDPR 이슈 가능) |
| 8 | 소프트 삭제 데이터 미연동 | [schema.sql](file:///c:/tarot-user-app-withai/supabase/schema.sql) | 탈퇴 유저의 readings, visits 등 관련 데이터가 RLS에서 필터링되지 않음 |

---

### 데이터 무결성 & API

| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| 9 | 비원자적 쿠폰 사용 | [couponService.js](file:///c:/tarot-user-app-withai/src/services/couponService.js) | 조회→검증→삽입이 트랜잭션이 아님, 동시 사용 시 한도 초과 가능 |
| 10 | 클라이언트 시간 기반 사용량 계산 | [aiUsageService.js](file:///c:/tarot-user-app-withai/src/services/aiUsageService.js) | 디바이스 시간 조작으로 일일 한도 우회 가능 |
| 11 | Edge Function 레이트 리미팅 부재 | [ai-proxy/index.ts](file:///c:/tarot-user-app-withai/supabase/functions/ai-proxy/index.ts) | DB 조회 전 요청 제한이 없어 DDoS에 취약 |
| 12 | Edge Function 요청 크기 제한 없음 | [ai-proxy/index.ts](file:///c:/tarot-user-app-withai/supabase/functions/ai-proxy/index.ts) | `req.json()` 호출 전 바디 크기 미검증 |
| 13 | AI 응답 형태 검증 약함 | [aiService.js](file:///c:/tarot-user-app-withai/src/services/aiService.js) | `typeof data === 'object'`만 확인, 필수 필드 검증 없음 |
| 14 | 누락된 DB 인덱스 | [schema.sql](file:///c:/tarot-user-app-withai/supabase/schema.sql) | `readings.created_at`, `vote_responses.vote_id`, `visits.visit_date` 인덱스 누락 |

---

### 성능 & 메모리

| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| 15 | ScrollView로 긴 목록 렌더링 | History 화면 | `FlatList` 대신 `ScrollView + map()` 사용 — 모든 아이템이 한번에 렌더링됨 |
| 16 | 메모이제이션 전략 부재 | 컴포넌트 전반 | `React.memo()`, `useMemo()`, `useCallback()` 미사용, 불필요한 리렌더링 발생 가능 |
| 17 | 요청 취소 미구현 | [useAI.js](file:///c:/tarot-user-app-withai/src/hooks/useAI.js) | 컴포넌트 언마운트 시 진행 중인 요청이 취소되지 않아 메모리 누수 가능 |
| 18 | useHistoryLogic AbortController 없음 | [useHistoryLogic.js](file:///c:/tarot-user-app-withai/src/hooks/useHistoryLogic.js) | userId 변경 시 이전 요청 미취소 |
| 19 | 이미지 캐싱 전략 없음 | History/Fortune 컴포넌트 | 카드 이미지 로딩에 캐싱 미적용 |
| 20 | AsyncStorage 용량 모니터링 없음 | [storage/](file:///c:/tarot-user-app-withai/src/utils/storage) | Android 6MB 제한에 대한 관리 없음 |

---

### 코드 품질 & 유지보수

| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| 21 | God Function | [aiService.js](file:///c:/tarot-user-app-withai/src/services/aiService.js) | `requestTarotReading()` ~100줄 — 세션/한도/요청/파싱/에러처리 모두 포함 |
| 22 | 모놀리식 훅 | [useHistoryLogic.js](file:///c:/tarot-user-app-withai/src/hooks/useHistoryLogic.js), [useVoteLogic.js](file:///c:/tarot-user-app-withai/src/hooks/useVoteLogic.js) | 각각 10K, 8.5K — 관심사 분리 필요 |
| 23 | 하드코딩된 색상 | Vote, Fortune 컴포넌트 | `Colors` 상수 대신 `'#6B21A8'` 같은 하드코딩 사용 |
| 24 | 하드코딩된 버전 | Settings 화면 | `app.json`이나 `Constants.manifest`에서 읽지 않고 직접 입력 |
| 25 | 인라인 스타일 과다 | [MainNavigator.js](file:///c:/tarot-user-app-withai/src/navigation/MainNavigator.js), Fortune 컴포넌트 | StyleSheet 대신 인라인 객체 사용 |

---

### UX & 접근성

| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| 26 | 접근성 속성 누락 | 컴포넌트 전반 | `accessibilityLabel`, `accessibilityRole` 미설정 |
| 27 | 스켈레톤 로딩 미사용 | 컴포넌트 전반 | 스피너만 사용 — 스켈레톤 UI로 체감 성능 향상 가능 |
| 28 | 투표 버튼 디바운싱 없음 | Vote 화면 | 빠른 연타로 중복 투표 가능 |
| 29 | 로딩 상태 세분화 부족 | [AuthContext.js](file:///c:/tarot-user-app-withai/src/context/AuthContext.js) | 단일 `loading` boolean — 초기 로딩/로그인/로그아웃 구분 불가 |
| 30 | imageOptimizer 에러 처리 없음 | [imageOptimizer.js](file:///c:/tarot-user-app-withai/src/utils/imageOptimizer.js) | `manipulateAsync` 실패 시 에러가 처리되지 않고 전파됨 |

---

### 테스트

| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| 31 | 제한적 테스트 커버리지 | [test/](file:///c:/tarot-user-app-withai/test) | 서비스 단위 테스트만 존재 — 훅, 컴포넌트, 네비게이션, Edge Function, 통합 테스트 부재 |

---

## 🟢 Good Practices (잘 된 부분)

### 아키텍처 & 설계
- ✅ **관심사 분리**: services / hooks / components / context 구조가 잘 나뉨
- ✅ **React Query 도입**: 서버 상태 관리에 `@tanstack/react-query` 활용
- ✅ **인증 흐름**: 익명 로그인 → 영구 계정 전환 패턴 잘 구현
- ✅ **ErrorBoundary**: 적절한 폴백 UI와 재시도 기능
- ✅ **글로벌 에러 표시**: ErrorContext + GlobalErrorDisplay 조합

### 보안
- ✅ **Config 검증**: 필수 환경 변수 누락 시 명확한 에러
- ✅ **보안 체크 스크립트**: 시크릿 커밋 방지 (`security-check.cjs`)
- ✅ **RLS 활성화**: 모든 테이블에 Row Level Security 적용
- ✅ **쿠폰 코드 새니타이징**: 입력값 정규화 및 특수문자 제거

### 코드 품질
- ✅ **중앙화된 에러 메시지**: 한국어 에러 메시지 매핑
- ✅ **에러 분류 시스템**: 복구 가능/불가능 에러 구분
- ✅ **Optimistic Updates**: 투표 시스템에서 낙관적 업데이트 + 롤백
- ✅ **이미지 최적화**: 크기 제한 및 품질 조절
- ✅ **Prettierrc 설정**: 일관된 코드 포맷팅 규칙

### DB & 백엔드
- ✅ **UUID 기본키**: 적절한 Primary Key 전략
- ✅ **외래 키 제약조건**: 데이터 무결성 보장
- ✅ **Edge Function CORS**: 적절한 CORS 헤더 설정
- ✅ **Edge Function 인증 검증**: 요청 헤더에서 토큰 검증
- ✅ **타로 카드 데이터**: 완전한 카드 데이터셋 (한국어 이름/설명)

### 기타
- ✅ **방문 기록 & 연속 접속**: 포괄적인 출석 추적 시스템
- ✅ **AsyncStorage 래퍼**: 일관된 로컬 저장소 API
- ✅ **Auth Navigator 분리**: 인증/메인 네비게이션 흐름 깔끔하게 분리
- ✅ **에러 이벤트 시스템**: 이벤트 기반 에러 전파

---

## 🎯 우선순위별 개선 로드맵

### Phase 1: 긴급 (즉시)
1. **Supabase 클라이언트 통합** — 두 파일을 하나로 병합, 모든 서비스가 단일 인스턴스 사용
2. **하드코딩된 URL 제거** — 환경 변수 필수 검증 적용
3. **줄바꿈 문자 통일** — `.editorconfig` 추가, git 재정규화

### Phase 2: 단기 (1~2주)
4. `ensureSession()` 레이스 컨디션 수정 (뮤텍스 패턴)
5. 쿠폰 사용 원자성 확보 (Supabase RPC 함수)
6. AI 사용량 서버 시간 기반으로 변경
7. Edge Function 레이트 리미팅 추가
8. 누락된 DB 인덱스 추가
9. `ScrollView` → `FlatList` 전환 (History 화면)

### Phase 3: 중기 (1~2개월)
10. 요청 취소 패턴 적용 (`AbortController`)
11. 대규모 훅/컴포넌트 분리 리팩토링
12. 메모이제이션 전략 도입
13. 접근성(a11y) 속성 추가
14. 스켈레톤 로딩 UI 도입
15. 데이터 보존 정책 수립 및 구현

### Phase 4: 장기
16. TypeScript 마이그레이션 (또는 설정 제거)
17. 테스트 커버리지 확대 (컴포넌트, 훅, E2E)
18. 디자인 토큰 시스템 정비 (Colors 상수 일원화)
