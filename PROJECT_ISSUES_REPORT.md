# 프로젝트 점검 및 조치 리포트

점검 일시: 2026-02-24 15:32:34 UTC
업데이트 일시: 2026-02-24 15:37:00 UTC

## 조치 반영 요약
- 타입체크 체계를 앱/Edge Function으로 분리 (`tsconfig.app.json`, `tsconfig.edge.json`).
- `package.json`에 `security-check`, `typecheck`, `test` 스크립트 추가.
- `supabase/tests/rls_checks.sql`의 역할 기반 검증 TODO를 실행 가능한 점검 예시로 보강.
- `ai-proxy` 함수에 `AI_PROXY_REQUIRE_AUTH=true`일 때 인증 헤더를 강제하는 가드 추가.

## 남은 과제
- AI 프록시는 환경 변수 미설정 시 인증 강제가 비활성화되므로, 운영 환경에서 `AI_PROXY_REQUIRE_AUTH=true` 적용 필요.
- RLS 점검 스크립트는 샘플이므로 CI 자동화(pgtap 또는 별도 테스트 파이프라인) 권장.
