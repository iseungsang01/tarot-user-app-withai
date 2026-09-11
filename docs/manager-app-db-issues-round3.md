# 유저앱 회신 (3차) — 쿠폰 사용 경로 이관 완료 + 남은 요청 2건

작성일: 2026-09-11 · 작성: 유저앱(tarot-user-app-withai)
회신 대상: 매니저 전달 사항 ①~⑤

> **후속**: §7 액션 표는 `manager-app-db-issues-round4.md` §6 으로 대체됐습니다.
> §1 의 500, §3 의 `use_my_coupon` 재적용 요청, §6-2 의 거취 선택지는 4차에서
> 답을 받아 닫혔습니다 — `use_my_coupon` 은 재적용하지 않는 것으로 확정입니다.

이번 회신으로 ①②③ 은 유저앱 쪽에서 닫혔고, **`use_my_coupon` 404 PGRST202 의 원인도
규명됐습니다 — 유저앱 SQL 이 매니저 함수를 DROP 하고 있었습니다.** ④ 는 유저앱에
적용 권한이 없어 그대로 매니저 요청으로 돌려드립니다.

---

## 0. 이번 회신의 근거 — 2026-09-11 운영 실측

모든 판단은 추정이 아니라 anon 키 probe 실측 위에 있습니다. 프로젝트 `gvoedaagemotwuzmfxfe`.
재현: `node supabase/tests/probe_rpc_surface.mjs` (자격증명 불필요, 상태 변경 없음)

| 대상 | 결과 | 뜻 |
|---|---|---|
| `app_configs` | 없음 (PGRST205) | 배포된 `redeem_coupon` 은 **여전히 GUC 판**이 확정적 |
| `redeem_coupon(int,text,text)` | 존재, `invalid_session` | 유저앱이 심어 놓은 GUC 판이 아직 살아 있음 |
| `use_my_coupon(text,integer)` | 없음 (PGRST202) | §3 에서 원인 규명 |
| `use_my_coupon_with_admin_password` | 없음 (PGRST202) | — |
| `cleanup_ai_guest_sessions` | 없음 (PGRST202) | §4 — 매니저 보고와 일치 |
| `verify_admin_password` | 없음 (PGRST202) | 매니저 DROP 확인 |
| uuid 기반 RPC 5개 | **0/5 노출** | §5 — 매니저 DROP 교차 확인 |
| `POST /functions/v1/redeem-coupon` | **배포돼 있음** | §1 |

---

## 1. ① 클라이언트 호출 전환 — ✅ 완료

`rpc('redeem_coupon')` 호출을 걷어내고 **`POST /functions/v1/redeem-coupon`** 으로 바꿨습니다.
round2 §2 [확정3] 에서 제안한 설계 그대로입니다 — 관리자 비밀번호는 DB 에 두지 않고
Edge Function 시크릿과 대조합니다.

- `src/services/supabaseClient.js` — `supabase.functions.invoke('redeem-coupon', …)`
- `src/services/couponService.js` — 페이로드 전환
- `src/screens/ticket/TicketScreen.js` — 함수가 직접 내는 코드 2개(`invalid_request`,
  `coupon_redemption_failed`)에 한국어 문구 추가

### 계약은 운영에서 실측해 맞췄습니다

문서에 요청 스키마가 없어서 배포본에 직접 물어봤습니다. **필드명이 camelCase 입니다.**

```
POST /functions/v1/redeem-coupon
  { "sessionToken": "...", "couponId": 12, "adminPassword": "..." }
  → { "success": boolean, "message": string }

{ session_token, coupon_id, admin_password }      → 400 invalid_request
{ p_session_token, p_coupon_id, p_admin_password } → 400 invalid_request
{ sessionToken, couponId, adminPassword }          → 통과 (검증 단계 진입)
```

`supabase-js` 가 비-2xx 를 `FunctionsHttpError` 로 감싸 버려서 `{success, message}` 본문이
사라집니다. 본문을 다시 꺼내 기존 호출부 계약으로 되돌리는 처리를 넣었고 테스트로 고정했습니다
(`test/services/supabaseClientRedeemCoupon.test.cjs`).

### ⚠️ 확인 부탁 — 무효 세션에 500 이 납니다

```
{ sessionToken: "__probe_invalid__", couponId: 1, adminPassword: "__probe__" }
  → 500 {"success":false,"message":"coupon_redemption_failed"}
```

기대값은 `invalid_session` 또는 `invalid_admin_password` 입니다. 500 + 일반 메시지가
나오는 건 **함수가 호출하는 내부 RPC(`redeem_coupon_internal` 등)에서 예외가 올라오고
있다는 뜻**으로 보입니다. anon 으로는 내부 RPC 의 "없음"과 "정상적으로 숨겨짐"을 구분할 수
없어 여기까지가 한계입니다. 두 가지만 알려주세요.

1. `redeem-coupon` 이 호출하는 내부 RPC 가 운영에 배포돼 있습니까?
2. 무효 세션·오답 비밀번호일 때 의도한 응답 코드가 무엇입니까?
   (유저앱은 `invalid_session` / `invalid_admin_password` 를 각각 다른 문구로 띄웁니다)

**정상 동작 확인은 실제 세션 + 실제 관리자 비밀번호가 있어야 가능해서 유저앱 쪽에서는
끝까지 검증하지 못했습니다.** 매장에서 한 번 사용해 보시면 즉시 갈립니다.

### 소유 문제 하나 — 이 함수의 소스가 유저앱에 없습니다

`supabase/config.toml` 에 선언된 Edge Function 은 `ai-proxy` 하나뿐이고, `redeem-coupon`
소스는 유저앱 저장소에 없습니다. 지금 **고객 앱의 핵심 동선이 유저앱에서 읽지도 고치지도
못하는 함수에 의존**합니다. 소스 위치와 배포 주체를 알려주시고, 가능하면 유저앱 저장소로
옮기거나 사본을 주세요.

---

## 2. ②③ `redeem_coupon` CREATE/GRANT · GUC 코드 정리 — ✅ 완료

지적하신 대로 범위가 넓었습니다. 전부 처리했습니다.

| 위치 | 처리 |
|---|---|
| `supabase/schema.sql:700` 정의 | 삭제 |
| `supabase/schema.sql:990` GRANT | 삭제 |
| `supabase/schema.sql:727` GUC 2줄 | 정의와 함께 삭제 |
| `20260601051045_baseline_app_schema.sql:714, 885` | **파일은 그대로** — 아래 후속 마이그레이션으로 정리 |
| `20260604042031_apply_integrated_schema.sql:648, 810` | 동일 |

제안하신 `20260728163000_revoke_uuid_account_rpcs.sql` 방식을 그대로 따랐습니다:
**`20260911150000_retire_user_app_redeem_coupon.sql`**

이미 적용된 마이그레이션을 수정하지 않았기 때문에 `db reset` 을 해도 GUC 판이
살아남지 못합니다. 뒤에서 정리하는 쪽이 이깁니다.

### 안전장치 — 남의 객체는 건드리지 않습니다

무조건 DROP 하지 않고 **본문이 GUC 를 읽는 "유저앱 판"일 때만 DROP** 합니다.

```sql
IF v_def LIKE '%current_setting(''app.admin_password%' THEN
  DROP FUNCTION public.redeem_coupon(integer, text, text);
ELSE
  REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated;
END IF;
```

매니저가 `app_configs` 판을 올려 두신 상태라면 그건 남겨 두고 클라이언트 롤 권한만
회수합니다. `to_regprocedure` 로 존재 여부를 먼저 보므로 이미 DROP 된 환경에서도 깨지지
않습니다. (2026-09-11 실측 기준 `app_configs` 가 없으므로 배포본은 GUC 판이 확정적입니다)

회귀 방지 테스트도 교체했습니다 — `redeem_coupon` 정의든 GRANT든 GUC 읽기든 하나라도
되살아나면 CI 가 깨집니다 (`test/services/aiUsageSchema.test.cjs`).

---

## 3. 🔴 `use_my_coupon` 404 PGRST202 — **원인은 유저앱이었습니다**

열려 있던 두 건 중 하나입니다. 매니저 정본이 운영에 덜 적용된 게 아니라,
**유저앱 SQL 이 매니저 함수를 DROP 하고 있었습니다.**

```sql
-- supabase/schema.sql:327-328  (+ 20260601051045:323-324, 20260604042031:281-282)
DROP FUNCTION IF EXISTS public.use_my_coupon(text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.use_my_coupon_with_admin_password(text, integer, text) CASCADE;
```

"현재 앱이 쓰지 않는 낡은 함수 정리" 블록에 들어 있었는데, 이건 유저앱이 안 쓰는 함수일 뿐
**매니저 정본 `SupabaseSQL.sql:543` 의 함수**였습니다. 유저앱 마이그레이션이 뒤에 적용될
때마다 매니저 함수가 지워졌고, 그래서 `:693` GRANT 까지 있는데도 404 가 났습니다.
round2 §2 에서 "매니저 정본도 운영에 완전히 적용된 상태가 아닌 것 같다"고 쓴 것은
**틀렸습니다. 정정합니다.**

**유저앱 조치**: `schema.sql` 에서 두 DROP 을 삭제했습니다. 다시 들어오면 테스트가 깨집니다.
이미 적용된 마이그레이션 2개의 DROP 은 되돌릴 수 없지만, 뒤에 오는 유저앱 SQL 이
더 이상 지우지 않으므로 **매니저가 재적용하면 그대로 남습니다.**

**매니저 요청**: `use_my_coupon(text, integer)` 을 재적용해 주세요. `SupabaseSQL.sql:543, 693`
을 그대로 실행하면 됩니다.

다만 재적용 전에 §6-2 를 봐 주세요 — 쿠폰 사용 경로가 Edge Function 으로 넘어갔기 때문에
이 함수가 **앞으로 필요한지 자체가 결정 사항**입니다.

---

## 4. ④ `cleanup_ai_guest_sessions` 운영 적용 — ⚠️ 유저앱은 적용할 수 없습니다

round2 §3 에서 말씀드린 상황이 그대로입니다. 유저앱에는 `service_role` 키도,
`DATABASE_URL` 도, Supabase CLI 링크도 없습니다. `.env` 에는 anon 키만 있습니다.
**마이그레이션을 운영에 적용할 주체가 유저앱이 아닙니다.**

### 함께 확인해 주셔야 할 것 — 이 건은 단독 누락이 아닐 수 있습니다

`cleanup_ai_guest_sessions` 는 `20260728120000_fix_account_deletion_and_guest_session_cleanup.sql`
에만 정의돼 있습니다. 그게 운영에 없다는 것은 **이 마이그레이션 전체가 적용되지 않았다**는
뜻이고, 같은 파일에 들어 있는 **탈퇴 버그 수정도 운영에 없다**는 뜻입니다.

> `delete_my_account(text, text)` 가 `phone_number` 에 접미사를 붙이던 것을 제거한 수정.
> 접미사가 붙으면 `varchar(13)` 을 초과해 **탈퇴가 100% 22001 로 실패**합니다.

확인 부탁드립니다. 실제로 미적용이라면 쿠폰보다 이쪽이 급합니다.

### 붙여넣기용 SQL

파일 전체를 적용하시는 게 가장 깔끔합니다
(`supabase/migrations/20260728120000_fix_account_deletion_and_guest_session_cleanup.sql`).
게스트 세션 정리 부분만 떼면 이것입니다.

```sql
CREATE INDEX IF NOT EXISTS idx_ai_guest_sessions_expires_at
  ON public.ai_guest_sessions(expires_at);

CREATE OR REPLACE FUNCTION public.cleanup_ai_guest_sessions(p_retention interval DEFAULT interval '7 days')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.ai_guest_sessions
  WHERE expires_at < now() - p_retention
     OR (revoked_at IS NOT NULL AND revoked_at < now() - p_retention);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$func$;

REVOKE ALL ON FUNCTION public.cleanup_ai_guest_sessions(interval) FROM PUBLIC, anon, authenticated;
```

> 위 블록은 붙여넣기 편하도록 본문 구분자를 `$func$` 로 바꿔 둔 것 외에는
> 마이그레이션 원문과 같습니다.

적용해 주시면 `20260911_finalize.sql` 재실행으로 cron 잡을 붙이시면 됩니다.
제안하신 04:00 KST 일 1회에 동의합니다 (round2 §4 9-1).

---

## 5. ⑤ 매니저 1~4번 완료 — 실측으로 교차 확인했습니다

| 항목 | 유저앱 실측 |
|---|---|
| uuid 계정 RPC 5개 프로덕션 DROP | ✅ **0/5 노출** 확인 (7월 28일에는 5/5 노출이었습니다) |
| `verify_admin_password` 제거 | ✅ PGRST202 확인 |
| 유저앱 `schema.sql` 정리 상태 | ✅ 5개 정의·GRANT 없음 |
| REVOKE 마이그레이션 존재 | ✅ `20260728163000` — 되살아날 위험 없음 확인 |

회귀 가드도 그대로 살아 있습니다 (`aiUsageSchema.test.cjs` —
`uuid-keyed account RPCs are gone and never re-granted`). 확인 감사합니다.

---

## 6. 남아 있는 것

### 6-1. N6 쿠폰 유효기간 정책 — 이제 결정 지점이 하나로 모였습니다

유저앱은 쿠폰 사용 SQL 을 더 이상 소유하지 않습니다. 그래서 만료 검사와
`customers.coupons` 차감은 **`redeem-coupon` 이 호출하는 내부 RPC 한 곳**에 있으면 됩니다.
round2 §4 5-1/5-2 에서 "존치 시 유저앱이 넣겠다"고 했던 건 이제 해당 사항이 없습니다.

확정해 주셔야 할 것:

1. **만료 쿠폰 사용을 막습니까?** 막는다면 내부 RPC 에 `valid_until` 검사를 넣어야 합니다.
   지금 `get_my_coupons(p_valid_only := true)` 는 만료분을 걸러내는데 사용 시점엔 검사가
   없어, 목록에서 안 보이는 쿠폰이 ID 만 알면 사용되는 상태입니다.
2. **거절 시 반환 코드** — `coupon_expired` 로 주시면 유저앱이 전용 문구를 붙이겠습니다.
   지금은 매핑이 없어서 일반 실패 문구로 떨어집니다.
3. **`customers.coupons` 차감**을 같은 트랜잭션에 넣을지.

### 6-2. `use_my_coupon` 의 거취

`redeem-coupon` 내부 RPC 가 이미 별도로 있다면 `use_my_coupon` 은 중복입니다.
셋 중 하나로 정해 주세요.

- (A) 내부 RPC 가 `use_my_coupon` 을 감싸 호출 → `use_my_coupon` 재적용 필요, 로직 1벌
- (B) 내부 RPC 가 전부 처리 → `use_my_coupon` 재적용 불필요, 매니저 정본에서 삭제
- (C) 매니저 앱이 별도로 `use_my_coupon` 을 쓴다 → 재적용 후 양쪽 유지

round2 에서 "매니저가 배포하실 거라면 내부 RPC 가 그걸 호출하는 형태로 맞추겠다"고
말씀드렸는데, 그 사이 Edge Function 이 먼저 배포돼서 다시 여쭙습니다.

### 6-3. 브루트포스 방어 위치

round2 §2 에서 물어본 항목인데 답을 못 받았습니다. `redeem-coupon` 은 anon 키만 있으면
누구나 호출할 수 있어 관리자 비밀번호 대입이 가능합니다. 함수 단에 IP·세션 레이트리밋이
걸려 있는지, `login_attempt_tracker` 를 재사용하는지 알려주세요.

---

## 7. 갱신된 액션 표 (round2 §5 대체)

| 순서 | 작업 | 담당 | 상태 |
|---|---|---|---|
| 1 | IDOR `CREATE`/`GRANT` 삭제 + REVOKE | 유저앱 | ✅ 완료 |
| 2 | IDOR 5개 프로덕션 `DROP` | 매니저 | ✅ **완료** (2026-09-11 실측 확인) |
| 3 | `verify_admin_password` 제거 | 매니저 | ✅ **완료** (실측 확인) |
| 4 | 쿠폰 클라이언트 호출 → Edge Function 전환 | 유저앱 | ✅ 완료 (§1) |
| 5 | `redeem_coupon` CREATE/GRANT/GUC 정리 | 유저앱 | ✅ 완료 (§2) |
| 6 | `use_my_coupon` DROP 제거 | 유저앱 | ✅ 완료 (§3) |
| 7 | `20260728120000` 운영 적용 (`cleanup_ai_guest_sessions` + 탈퇴 수정) | **매니저** | ⚠️ 대기 — 유저앱 권한 없음 (§4) |
| 8 | `redeem-coupon` 500 원인 확인 + 응답 코드 확정 | **매니저** | ⚠️ 대기 (§1) |
| 9 | `redeem-coupon` 소스 위치·소유 확정 | **매니저** | ⚠️ 대기 (§1) |
| 10 | `use_my_coupon` 재적용 여부 결정 | **매니저** | ⚠️ 대기 (§3, §6-2) |
| 11 | N6 쿠폰 유효기간 정책 확정 | **매니저** | ⚠️ 대기 (§6-1) |
| 12 | 브루트포스 방어 위치 확정 | **매니저** | ⚠️ 대기 (§6-3) |
| 13 | 감사 스크립트 실행 | **매니저** | ⚠️ 대기 — round2 §3 |
| 14 | N7 강제 비밀번호 변경 3개 항목 확정 | **매니저** | ⚠️ 대기 — round2 §2 |
| 15 | 탈퇴 익명화 | 유저앱 | 7번 적용 확인 후 |
| 16 | `report_type` 코드값 전환 | 유저앱 | 매니저 마이그레이션 후 |

---

## 부록 — 이번 변경

- `src/services/supabaseClient.js` / `couponService.js` / `TicketScreen.js` — Edge Function 전환
- `supabase/schema.sql` — `redeem_coupon` 정의·GRANT·GUC 삭제, `use_my_coupon` DROP 삭제
- `supabase/migrations/20260911150000_retire_user_app_redeem_coupon.sql` — 신규
- `test/services/aiUsageSchema.test.cjs` — 회귀 가드 교체
- `test/services/supabaseClientRedeemCoupon.test.cjs` — 신규
- `test/services/couponService.test.cjs` — 계약 갱신
