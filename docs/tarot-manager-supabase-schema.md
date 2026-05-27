# Tarot Manager App Supabase 공유 스키마

공유용 SQL: [`docs/tarot-manager-supabase-schema.sql`](./tarot-manager-supabase-schema.sql)

## 포함 범위

`tarot-manager-app` 코드에서 직접 사용하는 테이블만 정리했습니다.

- `customers`
- `visit_history`
- `coupon_history`
- `notices`
- `bug_reports`
- `votes`
- `vote_responses`

관리자 화면은 `src/supabaseClient.js`의 `supabaseAdmin` 클라이언트로 위 테이블에 직접 `.from(...)` CRUD를 수행합니다.

## 제외한 것

기존 `SupabaseSQL.md`에 있던 아래 항목은 현재 `tarot-manager-app`에서 직접 호출하지 않아 공유 스키마에서 제외했습니다.

- `app_configs` 기반 관리자 비밀번호 저장
- 고객 로그인/비밀번호 RPC (`register_customer`, `login_customer`, `verify_password`, `update_customer_password` 등)
- `login_attempt_tracker`
- `customer_password_audit_logs`
- AI proxy rate-limit/token quota 테이블

## 관리자 인증/RLS 전제

공유 SQL에는 현재 앱 구조에 필요한 RLS가 포함되어 있습니다.

- `public.is_admin()`이 `auth.jwt()->>'app_role' = 'admin'`인지 확인합니다.
- `admin-login` Edge Function이 `app_role: 'admin'` 클레임이 들어간 JWT를 발급해야 합니다.
- 다른 프로젝트에 공유할 때는 `supabase/functions/admin-login/index.ts`도 함께 공유하고, Edge Function secrets를 설정해야 합니다.

필요한 secrets:

- `ADMIN_ID`
- `ADMIN_PASSWORD_SHA256` 또는 `ADMIN_PASSWORD`
- `ADMIN_JWT_SECRET` — Supabase API가 검증할 수 있는 JWT secret과 일치해야 합니다.
- 선택: `ADMIN_JWT_TTL_SECONDS`

## 참고

`SupabaseSQL.md`는 현재 `.gitignore`에 들어간 오래된/전체 초기화용 문서에 가깝습니다. 다른 프로젝트에는 이 정리본을 공유하는 편이 안전합니다.
