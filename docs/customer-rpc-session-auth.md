# Customer RPC Session Auth

이 앱의 고객 인증은 Supabase Auth/가짜 이메일을 사용하지 않고 Postgres RPC 세션으로 처리한다.

## Runtime model

- `register_customer(p_phone, p_password, p_nickname)`이 `public.customers` row를 만든다.
- `login_customer(p_phone, p_password, p_client_fingerprint)`가 비밀번호를 검증하고 30일짜리 opaque `session_token`을 반환한다.
- 앱은 `session_token`을 `tarot_customer_session`에 저장한다.
- 앱 시작/새로고침은 `get_my_profile(p_session_token)`으로 회원정보를 복구한다.
- 로그아웃은 `logout_customer(p_session_token)`으로 서버 세션을 폐기하고 로컬 저장소를 지운다.

## Security model

- DB에는 세션 토큰 원문을 저장하지 않고 SHA-256 해시만 저장한다.
- `customer_sessions`는 RLS로 직접 접근을 막고, 고객 앱은 허용된 RPC만 호출한다.
- 기존 manager 앱의 Admin JWT 흐름은 별도 모델로 유지한다.
- 1차 범위는 인증/회원정보 조회이며 방문, 쿠폰, 투표, 버그 리포트의 RPC 전환은 후속 작업이다.

## Migration

적용 SQL은 `supabase/migrations/20260527062000_customer_rpc_sessions.sql`에 있다.
