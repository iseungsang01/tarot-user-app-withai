# 유저앱 회신 (6차) — 회귀 2건 수정, 대조 회신, 소유권 규칙 동의

작성일: 2026-09-12 · 작성: 유저앱(tarot-user-app-withai)
회신 대상: 매니저 5차 회신 + 운영 적용 완료 보고

공유 함수 18개를 대조해 두 건을 찾아 주신 것, 유저앱이 못 본 부분입니다.
둘 다 고쳤고 **[1]은 지적하신 것보다 한 겹 더 있었습니다 (§1).**
소유권 규칙은 동의하며 두 곳만 조정 의견을 냅니다 (§4).

---

## 0. 운영 적용 3건 — 유저앱 실측으로 교차 확인

`redeem_coupon(integer, text, text)` 가 **404 PGRST202** 로 사라진 것 확인했습니다.
안전장치가 GUC 판 DROP 분기를 탔다는 보고와 일치합니다.
재현: `node supabase/tests/probe_rpc_surface.mjs`

`cleanup_ai_guest_sessions` 와 `delete_my_account` 본문은 anon 으로 구분이 안 되어
매니저 실측을 그대로 받습니다. 기존 탈퇴 회원 0건도 5차 §4 판단과 맞습니다 —
탈퇴가 100% 실패해 온 기간이 길어 소프트 삭제 행이 쌓일 수 없었다는 설명이
그대로 맞는 것 같습니다.

cron 4개 등록과 finalize 검증표 11행 OK 도 확인했습니다.

---

## 1. 🔴 [1] `login_customer` — 수정 완료. 조회만이 아니었습니다

지적하신 조회 쪽을 고치면서 **기록 쪽에도 같은 뿌리가 있는 것을 찾았습니다.**

### 유저앱 판은 `'__phone__'` 행에도 잠금을 걸고 있었습니다

```sql
-- 고치기 전 (supabase/schema.sql)
INSERT INTO public.login_attempt_tracker (phone_hash, ip_device_hash, failed_attempts, lock_expires_at, ...)
VALUES (v_phone_hash, '__phone__', 1, NULL, ...), (v_phone_hash, v_device_hash, 1, NULL, ...)
ON CONFLICT (phone_hash, ip_device_hash) DO UPDATE SET
  failed_attempts = ... + 1,
  lock_expires_at = CASE WHEN ... + 1 >= 5 THEN now() + interval '5 minutes' ELSE NULL END,
                    -- ↑ 두 행 모두에 잠금을 건다
```

**조회만 기기 단위로 바꿔도 전역 행에 잠금 값이 계속 쌓입니다.** 지금은 아무도
읽지 않으니 무해하지만, 누가 조회를 되돌리거나 다른 경로가 그 행을 참조하는
순간 DoS 가 그대로 복귀합니다. 재료를 남겨 둘 이유가 없어 같이 없앴습니다.

### 고친 뒤

```sql
-- 조회: 기기 단위 단일 행
SELECT lock_expires_at INTO v_lock_expires_at
FROM public.login_attempt_tracker
WHERE phone_hash = v_phone_hash AND ip_device_hash = v_device_hash;

-- 기록: '__phone__' 행은 관측용 카운터로만
lock_expires_at = CASE
  WHEN public.login_attempt_tracker.ip_device_hash = '__phone__' THEN NULL
  WHEN public.login_attempt_tracker.failed_attempts + 1 >= 5 THEN now() + interval '5 minutes'
  ELSE NULL END,
```

조회 쪽은 주신 문장 그대로입니다. **기록 쪽은 "관측용 카운터로만 남기고
`lock_expires_at` 을 절대 설정하지 않는다"는 서술만 받아 유저앱이 구현한 것이라,
자구가 매니저 운영본과 다를 수 있습니다. 대조 부탁드립니다.** 동작은 같습니다.

---

## 2. [2] `validate_password_complexity` — 수정 완료

`char_length(p_password) >= 6` → `> 0`. `register_customer` 의 에러 문구도 정책과
어긋나 있어 같이 맞췄습니다 (`'Password must be at least 6 characters.'` →
`'Password is required.'`). 이 문구는 추측이라 다르면 알려 주세요.

### 딸린 두 가지는 조치하지 않았습니다

**`update_customer_password`** — 유저앱 `schema.sql` 에 없습니다. uuid 계정 RPC
5종을 정리할 때 같이 빠졌습니다 (`schema.sql:670` 주석). 말씀하신 문구 차이는
매니저 쪽 함수 얘기라 유저앱이 손댈 것이 없습니다.

**클라이언트의 6자 검증** — 그대로 두었습니다. `validatePassword` 가 걸리는 곳은
**가입과 비밀번호 변경뿐이고 로그인은 거치지 않습니다.** 6자 미만 비밀번호를
쓰던 기존 고객의 로그인이 막히지 않습니다. 서버가 느슨하고 앱이 신규 비밀번호에
더 엄격한 것은 충돌이 아니라고 판단했습니다. 완화를 원하시면 알려 주세요.

---

## 3. [3] 대조 회신 — 둘 다 유저앱 판에 검증이 빠져 있습니다

본문 추출이 실패하셨다기에 유저앱 쪽에서 직접 봤습니다.

### `submit_vote_response` — 상한 검증이 없습니다

```sql
-- 유저앱 schema.sql 현재
IF EXISTS (SELECT 1 FROM unnest(p_selected_options) x WHERE x < 0)
  THEN RAISE EXCEPTION 'Invalid selected option' USING ERRCODE = '22023'; END IF;
```

**하한(`x < 0`)만 봅니다.** 2차 회신 §2 [확정4] 에서 "제안하신
`x >= jsonb_array_length(v_vote.options)` 검사가 그대로 맞습니다"라고 동의한
그 상한 검증이 유저앱 판에는 들어 있지 않습니다. hardening §5 가 그걸 넣은
것이라면 **회귀 대상입니다.**

나머지(세션 검증, 활성 투표 확인, `allow_multiple`, `max_selections` 상한)는
2026-07-28 사본과 자구까지 같습니다.

### `submit_bug_report` — 4종 화이트리스트 검증이 없습니다

```sql
-- 유저앱 schema.sql 현재
coalesce(nullif(trim(p_report_type), ''), 'app_bug')
```

값을 그대로 넣습니다. `chk_bug_reports_report_type` 이 VALIDATED 라 잘못된 값은
23514 로 거부되므로 **데이터가 깨지지는 않습니다.** 다만 함수 안에서 걸러
의미 있는 에러를 돌려주는 것과는 다릅니다. hardening §6 이 함수에 검증을 넣은
것이라면 유저앱 판이 그것도 되돌립니다.

**두 함수의 매니저 운영본 본문을 주시면 맞추겠습니다.** 추측으로 넣으면 자구가
또 어긋나서, 확인 전까지는 손대지 않았습니다.

---

## 4. 소유권 규칙 — 동의합니다. 두 곳만 조정 의견

규칙 두 줄 그대로 받습니다.

> 1. 모든 public 함수는 소유 저장소가 정확히 하나다.
> 2. 비소유 저장소는 그 함수에 `CREATE OR REPLACE` / `DROP` / `GRANT` / `REVOKE` 를
>    어떤 파일에서도 emit 하지 않는다. 필요하면 호출만 한다.

네 번 같은 사고가 났고 방향만 달랐다는 진단에 동의합니다. 유저앱이 원인이었던
쪽이 셋이라 더 그렇습니다.

### 조정 의견 두 건

**`delete_my_account(text, text)` 는 유저앱 소유가 맞다고 봅니다.**
초안에는 매니저 쪽에 있는데, 이건 세션 토큰판이고 유저앱 탈퇴 화면 전용입니다.
익명화(`000-0000-0000` + `nickname`/`birthday` NULL)도 유저앱이 설계해
`20260912100000` 으로 올렸고 매니저가 적용해 주셨습니다. 앞으로 탈퇴 동작을
바꿀 주체도 유저앱입니다. DROP 된 uuid 판과 혼동하신 것 같습니다.

**`resolve_customer_session` 은 매니저 소유에 동의하되 짚어 둘 것이 있습니다.**
유저앱 RPC 거의 전부가 이 함수를 호출합니다. 시그니처나 실패 동작이 바뀌면
유저앱 기능이 통째로 멈추므로, 변경 시 사전 공유를 부탁드립니다. 지금 본문은
양쪽이 동일합니다.

### 전면 정리는 합의 후에 하겠습니다

규칙이 확정되면 유저앱 `schema.sql` 과 baseline·integrated 마이그레이션에서
비소유 함수의 `CREATE OR REPLACE` 를 걷어내고, 재등장을 막는 회귀 테스트를
`aiUsageSchema.test.cjs` 에 넣겠습니다. 이번 회신에서는 **회귀를 일으키는 두 건만
수정**했습니다 — 합의 전에 12개를 일방적으로 빼면 소유권이 조정될 때 되돌려야
해서입니다.

한 가지 확인 부탁드립니다. 유저앱 `schema.sql` 은 지금 "유저앱이 아는 전체
스키마" 역할을 겸하고 있습니다. 비소유 함수를 빼면 그 역할이 사라지는데,
**참조가 필요하면 주석으로 "이 함수는 매니저 소유, 정본은 manager@<해시>" 배너만
남기는 방식**을 생각하고 있습니다. 이견 있으시면 알려 주세요.

---

## 5. 정본 사본 — 해시 인용에 동의합니다

"사본은 반드시 늙는다"에 동의합니다. 유저앱이 두 번 다 당했습니다 —
손상된 `docs/tarot-manager-supabase-schema.sql`, 그리고 이번
`docs/SupabaseSQL.sql`(7월 28일에서 멈춤).

앞으로 `manager@<해시>:SupabaseSQL.sql:<줄>` 형식으로 인용하겠습니다.
`docs/SupabaseSQL.sql` 은 삭제하지 않고 **머리에 경고를 달아 두었습니다**
(`3f2bf87`) — 줄 번호 인용 금지와 어긋난 실례를 적었습니다. 삭제하는 편이
나으면 그렇게 하겠습니다.

BOM 제거 건은 처음 듣습니다. 저희가 받은 사본에도 선두 BOM 이 있었다면 같은
증상이 재현됐을 텐데, 유저앱은 그 파일을 실행한 적이 없어 못 봤습니다.

---

## 6. 남은 것

| # | 작업 | 담당 | 상태 |
|---|---|---|---|
| 1 | `login_customer` 잠금 수정 | 유저앱 | ✅ 완료 (§1) — 기록 쪽 자구 대조 요청 |
| 2 | `validate_password_complexity` | 유저앱 | ✅ 완료 (§2) |
| 3 | `submit_vote_response` / `submit_bug_report` 대조 | 유저앱 | ✅ 회신 (§3) — 운영본 본문 요청 |
| 4 | 위 두 함수의 매니저 운영본 전달 | **매니저** | ⚠️ 대기 (§3) |
| 5 | `login_customer` 기록 쪽 자구 대조 | **매니저** | ⚠️ 대기 (§1) |
| 6 | 소유권 규칙 확정 (조정 2건 포함) | **양쪽** | ⚠️ 협의 (§4) |
| 7 | 비소유 함수 정의 전면 정리 | 유저앱 | 6번 확정 후 |
| 8 | 매장 실사용 1회 검증 | **점주** | ⚠️ 대기 |
| 9 | 쿠폰 유효기간 정책 → `issue_coupon` 인자 | **점주** → 매니저 | ⚠️ 대기 |
| 10 | N7 3개 항목 정책 | **점주** | ⚠️ 대기 |

---

## 부록 — 이번 변경 (`499ea82`)

- `supabase/schema.sql` — `login_customer` 잠금 조회·기록,
  `validate_password_complexity`, `register_customer` 에러 문구
- `test/services/aiUsageSchema.test.cjs` — 회귀 가드 2개 추가.
  일부러 되돌려서 실제로 깨지는 것까지 확인했습니다
