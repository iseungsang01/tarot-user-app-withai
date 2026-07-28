# 매니저 앱 협의 요청 — DB 무결성 점검 결과

작성일: 2026-07-28 · 작성: 유저앱(tarot-user-app-withai)
대상: 매니저 앱 스키마(`docs/tarot-manager-supabase-schema.sql`) 소유 항목

---

## 0. 왜 협의가 필요한가 (소유권 경계)

두 앱이 같은 Supabase 프로젝트를 쓰고, 스키마 파일을 **각자 한 벌씩** 들고 있습니다.
둘 다 `CREATE TABLE IF NOT EXISTS` / `CREATE OR REPLACE FUNCTION` 방식이라
**나중에 적용한 쪽이 함수를 덮어씁니다.**

함수 정의를 대조한 결과:

| 구분 | 대상 | 비고 |
|---|---|---|
| 유저앱 전용 | `get_my_visits`, `get_my_visit`, `hide_my_visit`, `issue_ai_guest_session`, `logout_ai_guest_session`, `resolve_ai_proxy_session`, `verify_my_password`, `update_my_password`, `delete_my_account(text,text)`, `cleanup_ai_guest_sessions`, 테이블 `ai_guest_sessions` | 유저앱이 단독 수정 |
| 매니저 전용 | `verify_admin_password`, 테이블 `app_configs` | 매니저가 단독 수정 |
| **양쪽 중복 정의** | 나머지 전부 — 테이블 7개 + `login_attempt_tracker`/`customer_sessions`/`customer_password_audit_logs`, `login_customer`, `register_customer`, `redeem_coupon`, `submit_vote_response`, `delete_my_account(uuid)` 등 | **덮어쓰기 충돌 발생 지점** |

아래 항목은 전부 "양쪽 중복" 또는 "매니저 전용"이라 유저앱이 단독으로 고치면
매니저 쪽 재배포 때 되돌아갑니다.

> 유저앱이 이미 처리한 것은 이 문서 맨 아래 "유저앱에서 완료한 조치"를 참고해 주세요.

---

## 1. 🔴 최우선: `redeem_coupon` 관리자 비밀번호 출처가 두 벌로 갈려 있음

**증상**: 과거 쿠폰 사용이 깨졌던 그 건입니다. 아직 재발 조건이 그대로 남아 있습니다.

| 소스 | 관리자 비밀번호를 읽는 곳 |
|---|---|
| 매니저 `docs/tarot-manager-supabase-schema.sql:592` | `public.app_configs WHERE key = 'admin_password'` ✅ |
| 유저앱 `supabase/schema.sql:775`, 마이그레이션 2개 | `current_setting('app.admin_password_hash', true)` ❌ |

유저앱 SQL 중 **하나라도 다시 적용되면** `CREATE OR REPLACE`가 매니저 버전을 덮어써서
GUC를 읽게 되고, GUC가 세팅돼 있지 않으면 모든 쿠폰 사용이 `invalid_admin_password`로 실패합니다.

**더 나쁜 점**: 유저앱 테스트 `test/services/aiUsageSchema.test.cjs:30-31`이
GUC 버전을 **통과 조건으로 못 박아** 두었습니다. 그래서 유저앱에서 이걸 고치면 테스트가 깨집니다.
유저앱이 단독으로 바꾸지 않고 여기에 올리는 이유입니다.

**요청**: 아래 중 택 1을 확정해 주세요.
- **(A) 권장** — `redeem_coupon` 소유권을 매니저로 단일화. 유저앱은 정의를 삭제하고
  테스트도 `app_configs` 기준으로 교체합니다. 유저앱에서 처리할 작업량은 작습니다.
- (B) 유저앱 정의를 `app_configs` 버전으로 동기화(양쪽 동일 본문 유지). 계속 수동 동기화 부담이 남습니다.

---

## 2. 🔴 `delete_my_account(uuid)` — 동일한 탈퇴 실패 버그 + 인증 없음

`docs/tarot-manager-supabase-schema.sql:495-503`

```sql
UPDATE public.customers
SET deleted_at = now(),
    phone_number = phone_number || '_deleted_' || substring(md5(random()::text) from 1 for 5)
WHERE id = p_id AND deleted_at IS NULL;
```

**문제 1 — 항상 실패합니다.**
`phone_number`는 `varchar(13)`이고 `010-1234-5678`이 정확히 13자입니다.
`_deleted_`(9자) + md5 5자를 붙이면 27자 → `SQLSTATE 22001 value too long`.
타입이 넓었더라도 `chk_customers_phone_format` 정규식(`^\d{3}-\d{3,4}-\d{4}$`, `$` 앵커)에서
`23514`로 막힙니다. 이 함수로는 탈퇴가 **구조적으로 불가능**합니다.

**문제 2 — 접미사 자체가 불필요합니다.**
중복 회피 목적이었을 텐데, 유니크 인덱스가 이미 부분 인덱스입니다:
```sql
CREATE UNIQUE INDEX idx_customers_phone_active ON customers(phone_number) WHERE deleted_at IS NULL;
```
소프트 삭제된 행은 유니크 검사 대상이 아니라 접미사 없이도 동일 번호 재가입이 정상 동작합니다.

**문제 3 — 세션 검증이 없습니다.**
`p_id`만 받고 `resolve_customer_session` 호출이 없는데 `anon`에 EXECUTE가 부여돼 있습니다
(`:728`). anon 키는 앱에 배포되므로, **uuid만 알면 아무나 남의 계정을 탈퇴시킬 수 있습니다.**
같은 문제가 4개 더 있습니다:

| 함수 | GRANT 위치 | 세션 검증 |
|---|---|---|
| `delete_my_account(uuid)` | `:728` | ❌ 없음 |
| `update_my_nickname(uuid, text)` | `:727` | ❌ 없음 |
| `soft_delete_customer(uuid)` | `:729` | ❌ 없음 |
| `verify_password(uuid, text)` | `:730` | ❌ 없음 |
| `update_customer_password(uuid, text, text)` | `:731` | ❌ 없음 |

`update_customer_password`는 **현재 비밀번호 확인 없이** 새 비밀번호로 덮어씁니다. 계정 탈취 경로입니다.

**요청**:
1. 위 5개 함수를 `anon`에서 REVOKE.
   유저앱은 이 5개를 호출하는 코드를 **이미 전부 제거**했으므로(아래 완료 조치 참고)
   REVOKE해도 유저앱은 깨지지 않습니다. 매니저 앱이 `authenticated`(admin JWT)로
   호출 중인 것이 있다면 그쪽 GRANT는 유지하시면 됩니다.
   ```sql
   REVOKE EXECUTE ON FUNCTION public.delete_my_account(uuid)                     FROM anon;
   REVOKE EXECUTE ON FUNCTION public.update_my_nickname(uuid, text)              FROM anon;
   REVOKE EXECUTE ON FUNCTION public.soft_delete_customer(uuid)                  FROM anon;
   REVOKE EXECUTE ON FUNCTION public.verify_password(uuid, text)                 FROM anon;
   REVOKE EXECUTE ON FUNCTION public.update_customer_password(uuid, text, text)  FROM anon;
   ```
2. `delete_my_account(uuid)` / `soft_delete_customer(uuid)`에서 `phone_number` 접미사 부착 제거.
   (유저앱 전용 `delete_my_account(text,text)`는 유저앱이 이미 수정 완료)

---

## 3. 🟠 탈퇴 시 개인정보 파기 정책 — 결정 필요

현재 소프트 삭제는 **전화번호를 그대로 남깁니다**. `_deleted_` 접미사는 마스킹이 아니라
단순 연결이라 원본 번호가 완전히 복원 가능합니다. 또한 FK가 `ON DELETE CASCADE`지만
실제 DELETE가 없으므로 `visit_history` / `coupon_history` / `vote_responses` / `bug_reports`가
전부 잔존합니다.

앱스토어·구글플레이 계정 삭제 요건과 개인정보 보호 관점에서 정책 확정이 필요합니다.

**제안**: 탈퇴 시 `phone_number = '000-0000-0000'`으로 치환.
`varchar(13)`에 들어가고 CHECK 정규식도 통과하며, 부분 유니크 인덱스가 삭제 행을 제외하므로
여러 건이 같은 값이어도 충돌하지 않습니다. 별도 DDL 변경 없이 가능합니다.

다만 **비가역**이라 매니저 앱의 정산·재가입 방지 로직이 원본 번호를 필요로 하는지 확인이 필요합니다.
필요하다면 `phone_hash` 컬럼을 추가해 해시만 보관하는 방식도 가능합니다.
확정 전까지 유저앱은 번호를 **보존**하도록 두었습니다.

---

## 4. 🟠 `login_customer` — 비밀번호 없는 고객이 로그인하면 500

`customers.password`는 `NOT NULL DEFAULT ''`이고, 스키마 주석에도
"Manager-created customers may start without a password"라고 명시돼 있습니다.
그런데 `login_customer`(매니저 스키마 `:396`)는:

```sql
IF v_customer.id IS NULL OR v_customer.password != extensions.crypt(p_password, v_customer.password) THEN
```

`password`가 `''`이면 `crypt(p_password, '')` → pgcrypto가 `invalid salt` 예외를 던집니다.
이 함수에는 EXCEPTION 블록이 없어 "비밀번호가 틀렸습니다"가 아니라 **RPC 500**이 나갑니다.
즉 매니저가 만든 고객은 앱에서 로그인 실패 사유조차 알 수 없습니다.

**요청**: 빈 비밀번호를 먼저 걸러 주세요.
```sql
IF v_customer.id IS NULL OR COALESCE(v_customer.password, '') = ''
   OR v_customer.password != extensions.crypt(p_password, v_customer.password) THEN
```
`must_change_password` 플래그를 어떻게 쓰실지도 함께 알려주시면 유저앱에서 초기 비밀번호
설정 플로우를 붙이겠습니다.

---

## 5. 🟠 쿠폰 — 만료 검사 누락 + 카운터 미차감

`redeem_coupon`(매니저 `:570`)이 `is_used`만 보고 `valid_until`을 확인하지 않습니다.
`get_my_coupons(p_valid_only := true)`는 만료 쿠폰을 걸러내는데 정작 사용 시점에는
검사가 없어서 **만료된 쿠폰이 사용 가능**합니다.

또한 `coupon_history.is_used`만 바꾸고 `customers.coupons` 카운터는 그대로 둡니다.
`current_stamps` / `total_stamps` / `visit_count` / `coupons` 네 개 모두 이력 테이블과
동기화하는 트리거나 제약이 없어 값이 영구적으로 어긋납니다.

**요청**:
1. `redeem_coupon`에 만료 검사 추가 (만료 쿠폰 사용 허용이 의도라면 알려주세요, 그대로 두겠습니다)
2. 쿠폰 사용 시 `customers.coupons` 차감을 같은 트랜잭션에 포함
3. 카운터 정합성 방식 결정 — 트리거 자동 동기화 vs 주기 배치 보정

현재 드리프트 규모는 `supabase/tests/db_integrity_audit.sql` 5번 섹션으로 확인 가능합니다.

---

## 6. 🟡 `votes` / `vote_responses` 제약 부족

`submit_vote_response`는 선택값이 음수인지만 봅니다(`x < 0`). 다음이 전부 통과합니다:

- **옵션 범위 초과** — `options` 배열 길이보다 큰 인덱스
- **중복 선택** — `[1,1]`. `get_vote_summary`가 `unnest`로 세므로 **집계가 부풀려집니다**
- `allow_multiple = false`인데 `max_selections > 1`인 투표
- `max_selections`가 실제 옵션 개수보다 큰 투표

**요청**: 아래 제약 추가 검토
```sql
ALTER TABLE public.votes ADD CONSTRAINT chk_votes_max_selections
  CHECK (max_selections <= jsonb_array_length(options)
         AND (allow_multiple OR max_selections = 1));
```
`submit_vote_response`의 검증 강화(범위·중복)도 함께 필요합니다.
기존 데이터 위반 여부는 감사 스크립트 7번 섹션으로 확인해 주세요.

---

## 7. 🟡 `bug_reports.report_type` 값이 3종으로 갈려 있음

| 값 | 출처 |
|---|---|
| `'앱 버그'` | 컬럼 DEFAULT (매니저 스키마 `:72`) |
| `'app_bug'` | `submit_bug_report` RPC 기본값 (`:706`) |
| `'어플 버그'` | 유저앱 클라이언트가 실제로 보내는 값 |

CHECK 제약이 없어 셋 다 저장됩니다. `status`에는 CHECK가 있는 것과 대조적입니다.
매니저 앱에서 타입별 필터·통계를 쓰신다면 현재 결과가 정확하지 않습니다.

**요청**: 정본 값 집합을 확정해 주세요. 확정되면 유저앱 클라이언트를 맞추고,
매니저 쪽에서 CHECK 제약 + 기존 데이터 마이그레이션을 해주시면 됩니다.

---

## 8. 🟡 `visit_history` 고객 쓰기 경로 부재

유저앱에 `visit_history` 직접 INSERT/UPDATE 코드가 남아 있습니다
(`src/services/supabaseClient.js:49,53`). 그런데 `visit_history`는 GRANT가 `authenticated`에만
있고 RLS 정책도 `"Admin can manage"` 하나뿐이라 **anon으로는 실행 시 42501**입니다.

**현재 장애는 아닙니다.** 추적해 보니 `createVisit`은 호출자가 없고, `updateVisit`의 두 호출자는
로컬 전용 필드만 넘겨 서버 요청이 발생하지 않습니다. 도달 불가능한 코드입니다.
테스트가 걸려 있어 유저앱에서 임의 삭제하지 않고 남겨 두었습니다.

**요청**: 고객이 방문 기록을 직접 생성/수정하는 기능이 로드맵에 있는지 확인 부탁드립니다.
- 없다 → 유저앱에서 해당 코드와 테스트를 정리하겠습니다
- 있다 → `create_my_visit` RPC(SECURITY DEFINER) 신설이 필요합니다. 이때
  `customers.visit_count` / `current_stamps` 증가 규칙이 매니저 업무 로직이라 사양 협의가 필요합니다

---

## 9. 🟡 세션·로그인 시도 테이블 무한 증가

| 테이블 | 증가 요인 | 정리 |
|---|---|---|
| `customer_sessions` | 로그인 1회 = 행 1개 (만료 30일) | ❌ 없음 |
| `login_attempt_tracker` | (전화번호, 기기지문) 조합마다 행 생성 | ❌ 없음 |
| `ai_guest_sessions` | 게스트 세션 발급 1회 = 행 1개 | ✅ 유저앱이 정리 함수 추가 |

앞의 두 개는 매니저 스키마에도 정의된 공유 테이블이라 임의로 삭제하지 않았습니다.
현재 적재량은 감사 스크립트 9번 섹션으로 확인 가능합니다.

**요청**: pg_cron 활성화 및 정리 주기 승인. 유저앱이 추가한
`public.cleanup_ai_guest_sessions()`와 동일한 패턴으로 만들면 됩니다.

**추가 — `login_attempt_tracker` 락아웃 DoS**:
`login_customer`가 기기와 무관한 `'__phone__'` 키로 전역 잠금을 겁니다
(매니저 스키마 `:420` 부근). 즉 **타인의 전화번호로 5회 실패시키면 그 사람이 5분간
로그인할 수 없습니다.** 기기 단위 잠금만 남기거나, 전화번호 잠금 임계값을 크게 올리는
방향을 권합니다.

---

## 10. 🟡 그 외 확인 요청

- **`bug_reports.screenshot` 길이 무제한** — base64 이미지가 인라인으로 들어오면 TOAST 팽창.
  Storage 버킷 URL 참조 방식으로 바꾸거나 길이 상한이 필요합니다.
- **`nickname varchar(20)` 절단 없음** — `update_my_nickname`에 `left()` 처리가 없어
  21자 이상이면 22001. (`submit_bug_report`는 `left(...,100)` 처리가 되어 있어 대조적입니다.)
  현재 유저앱에는 닉네임 수정 UI가 없어 실사용 경로는 아닙니다.
- **`updated_at` 컬럼 부재** — `customers`, `notices`, `votes`, `coupon_history`.
  증분 동기화·감사 추적이 불가능합니다.
- **`customers.last_visit`만 NULL 허용** — 같은 테이블 `created_at`은 NOT NULL이라 일관성이 없습니다.
- **스키마 드리프트 감지 불가** — 모든 DDL이 `CREATE TABLE IF NOT EXISTS`라
  테이블이 이미 있으면 컬럼 타입·CHECK·UNIQUE 변경이 **전혀 반영되지 않습니다**.
  실제 운영 DB가 파일과 다를 수 있으므로, 위 항목들을 착수하기 전에
  `supabase/tests/db_integrity_audit.sql` 1·10번 섹션으로 현재 상태를 먼저 확인해 주세요.

---

## 유저앱에서 완료한 조치 (참고)

매니저 협의 없이 안전한 범위(유저앱 전용 객체 + 죽은 코드)만 처리했습니다.

1. **탈퇴 실패 수정** — `delete_my_account(p_session_token, input_password)`에서
   `phone_number` 접미사 부착 제거. 이 함수는 매니저 스키마에 없는 유저앱 전용이라
   매니저 재배포와 충돌하지 않습니다.
   → `supabase/migrations/20260728120000_fix_account_deletion_and_guest_session_cleanup.sql`
   → 앱의 실제 탈퇴 경로(`DeleteAccountScreen` → `customerService.deleteCustomer`)가
      이 함수를 쓰므로 **탈퇴 기능이 복구됩니다.**
2. **IDOR RPC 호출 코드 제거** — `authService.deleteAccount`, `authService.updateNickname`,
   `supabaseClient.updateMyNickname`. 모두 호출자가 없는 죽은 코드였습니다.
   **2번 항목의 REVOKE를 안전하게 적용하실 수 있습니다.**
3. **AI 게스트 세션 정리** — `cleanup_ai_guest_sessions(interval)` 추가.
   클라이언트 롤에는 노출하지 않았고, pg_cron 등록은 운영자 작업으로 남겨 두었습니다.
4. **회귀 테스트 2건 추가** — 접미사 재도입 방지, 정리 함수 권한 노출 방지.

전체 검증 쿼리: `supabase/tests/db_integrity_audit.sql` (읽기 전용, 10개 섹션)
