# 현재 프로젝트 문제점 분석 리포트

점검 일시: 2026-03-02 UTC

## 1) 즉시 해결이 필요한 문제 (High)

### 1-1. `npm run typecheck` 실패 (Edge Function 타입 해석 실패)
- 증상: `supabase/functions/ai-proxy/index.ts`의 URL import(`https://esm.sh/...`)를 로컬 TypeScript가 모듈로 해석하지 못해 전체 타입체크가 실패합니다.
- 영향: CI/배포 전 정적 검증이 깨진 상태로 남아, 회귀(regression)를 조기에 탐지하기 어렵습니다.
- 재현 명령: `npm run typecheck`
- 로그 핵심: `Cannot find module 'https://esm.sh/@supabase/supabase-js@2.49.8'`
- 관련 파일: `package.json`, `supabase/functions/ai-proxy/index.ts`

### 1-2. 실제 단위/통합 테스트 부재
- `test` 스크립트는 현재 `security-check` 래퍼이며, 앱 로직/훅/서비스에 대한 자동 테스트가 없습니다.
- 영향: 기능 추가/리팩터링 시 수동 검증 의존도가 높고, 복잡한 비즈니스 로직에서 장애 위험이 큽니다.
- 관련 파일: `package.json`, `scripts/security-check.sh`

## 2) 중기 개선 필요 문제 (Medium)

### 2-1. 보안 점검 범위가 매우 제한적
- `scripts/security-check.sh`는 2개 규칙(클라이언트 AI 키 참조 금지, 구 파일 존재 여부)만 검사합니다.
- 영향: 민감정보 노출 패턴, 위험 API 사용, 권한/정책 누락 등 다수 리스크를 놓칠 수 있습니다.

### 2-2. AI 프록시 입력 검증이 느슨함
- `messages` 배열 존재 여부만 확인하고, 각 메시지의 `role/content` 스키마 및 길이 제한 검증이 없습니다.
- 영향: 비정상 입력으로 인한 예외/비용 증가/예측 불가능 응답 가능성이 있습니다.
- 관련 파일: `supabase/functions/ai-proxy/index.ts`

### 2-3. 대용량 유틸 파일로 인한 유지보수성 저하
- `src/utils/storage.js`가 600+ 라인으로 파일 책임이 과도하게 집중되어 있습니다.
- 영향: 변경 영향도 파악/리뷰/테스트 작성이 어려워지고 결합도가 상승합니다.
- 관련 파일: `src/utils/storage.js`

## 3) 운영/환경 이슈 (Low)

### 3-1. npm 환경 경고 상시 발생
- 모든 npm 실행 시 `Unknown env config "http-proxy"` 경고가 반복 출력됩니다.
- 영향: CI 로그 가독성 저하 및 실제 오류 식별 지연 가능.

### 3-2. `npm audit` 수행 불가 (레지스트리 403)
- 현재 환경에서 npm advisory API 호출이 403으로 차단되어 취약점 스캔 자동화가 동작하지 않습니다.
- 영향: 의존성 취약점의 조기 탐지가 제한됩니다.

## 4) 권장 우선순위 액션 플랜

1. **타입체크 복구**: Edge Function 타입체크 전략을 Deno 친화적으로 분리(예: `deno check` 기반)하거나 TS 설정에서 URL import 해석 정책을 명확화.
2. **테스트 체계 도입**: 서비스 레이어(`src/services/*`)부터 최소 스모크 테스트/회귀 테스트 추가.
3. **보안 체크 확장**: 시크릿 패턴 스캔, 위험 API 사용 점검, CI에서 Supabase 정책/마이그레이션 정합성 검증 추가.
4. **구조 개선**: `storage.js`를 이미지/리뷰/캐시/정리 로직 단위로 분리.
5. **환경 정리**: npm proxy 설정 정리 및 audit 대체 경로(Snyk/GitHub Dependabot/사내 미러) 마련.

---

## 실행한 점검 명령
- `npm run typecheck` (실패: Edge Function URL import 타입 해석 오류)
- `npm run security-check` (성공)
- `npm audit --omit=dev --audit-level=high` (실패: advisory API 403)
- `rg -n "TODO|FIXME|HACK|@ts-ignore|any\b|console\.log|AI_PROXY_REQUIRE_AUTH|SUPABASE|OPENAI|GEMINI|http://" src supabase App.js scripts --glob '!node_modules/**'`
- `wc -l App.js src/**/*.js supabase/functions/ai-proxy/index.ts`
