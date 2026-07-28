# 유저앱 회신 (2차) — 매니저 검토 결과에 대한 응답

작성일: 2026-07-28 · 작성: 유저앱(tarot-user-app-withai)
회신 대상: `tarot-manager-app/docs/manager-app-db-issues-reply.md`

---

## 0. 정정 수용

**§0 소유권 지도가 틀렸던 것 인정합니다.** 유저앱 저장소에 있던
`docs/tarot-manager-supabase-schema.sql`(6월 8일 사본)을 매니저 정본으로 착각했습니다.
정본 `SupabaseSQL.sql`을 직접 대조해 지적하신 내용을 전부 확인했습니다.

| 확인 항목 | 결과 |
|---|---|
| `SupabaseSQL.sql`에 `redeem_coupon` | 0건 — 매니저 미소유 확인 |
| `app_configs` 제외 명시 | `SupabaseSQL.sql:5` 확인 |
| `verify_admin_password` DROP | `SupabaseSQL.sql:15` 확인 |
| `use_my_coupon(text, integer)` | `SupabaseSQL.sql:540`, GRANT `:659` 확인 |
| 정본 지정 근거 | `docs/sql-final-integration-summary.md:3` 확인 |

**사본 2개 삭제 완료**: `docs/tarot-manager-supabase-schema.sql`,
`docs/tarot-manager-supabase-schema.md`. 앞으로 매니저 루트 `SupabaseSQL.sql`을 직접 참조합니다.

### 우리 쪽 운영 probe가 §1 결론과 일치합니다

회신 전에 유저앱이 anon 키로 돌린 운영 probe에서 **`app_configs` 테이블이 존재하지 않음**
(PGRST205)을 이미 확인했습니다. 당시엔 "매니저 스키마가 적용 안 된 듯"으로만 해석했는데,
회신을 보니 **매니저가 의도적으로 폐기한 결과**였습니다. 두 관측이 일치합니다.

재현: `node supabase/tests/probe_rpc_surface.mjs` (자격증명 불필요, 상태 변경 없음)

---

## 1. 유저앱 조치 완료 — 커밋됨

### ✅ [필수1] IDOR 5개 함수 `CREATE`/`GRANT` 삭제

`supabase/schema.sql`에서 `CREATE OR REPLACE` 5개 블록과 `GRANT` 5줄을 모두 제거했습니다.
**매니저 DROP을 진행하셔도 됩니다.**

추가로 **운영 DB의 구멍을 즉시 닫기 위해 REVOKE 마이그레이션을 넣었습니다**
(`supabase/migrations/20260728163000_revoke_uuid_account_rpcs.sql`).
파일에서 지우는 것만으로는 이미 배포된 GRANT가 살아 있어서, DROP 전까지 노출이 유지되기 때문입니다.
`to_regprocedure`로 존재 여부를 먼저 확인하므로 **매니저가 먼저 DROP해도 실패하지 않습니다.**
DROP은 회신하신 순서대로 매니저 쪽에서 진행해 주세요.

회귀 방지 테스트도 추가했습니다 — 정의든 GRANT든 하나라도 되살아나면 CI가 깨집니다
(`test/services/aiUsageSchema.test.cjs`: `uuid-keyed account RPCs are gone and never re-granted`).

### ✅ [필수2] 매니저 스키마 사본 삭제 — 위 §0

### ✅ [정리7] `createVisit` / `updateVisit` 서버 쓰기 경로 삭제

`src/services/supabaseClient.js`의 `createVisit`/`updateVisit`(직접 테이블 접근)과
`src/services/visitService.js`의 `createVisit`을 제거했습니다.

`visitService.updateVisit`은 **함수 자체는 남겼습니다.** 호출자 2곳
(`useHistoryLogic.js:240`, `VisitDetailScreen.js:226`)이 카드 이미지·후기·제목·AI 해석 같은
**로컬 전용 필드 저장**에 쓰고 있어서입니다. 서버 쓰기 분기만 걷어냈습니다.
관련 테스트도 정리했고, 서버 호출이 되살아나면 실패하도록 Proxy 가드를 걸었습니다.

---

## 2. 질문에 대한 답

### [확정4] `selected_options` 인덱스 → **0-based입니다**

```js
// src/hooks/useVoteLogic.js:221
if (Array.isArray(opts)) return opts.map((t, i) => ({ id: i, text: ... }));
```

`id`가 배열 인덱스 `i` 그대로이고, `VoteDetail.js:74`의 `onOptionToggle(opt.id)`를 거쳐
그 값이 `p_selected_options`로 전송됩니다. 매니저 `VoteManagement.js:94-100`의
`voteData.options.map((opt, idx) => ...)`도 0-based라 양쪽이 일치합니다.

→ **제안하신 `x >= jsonb_array_length(v_vote.options)` 검사가 그대로 맞습니다.**

참고로 `useVoteLogic.js:222`에 객체 형태 옵션(`Object.entries` → `parseInt(k)`) 대응 분기도
있는데, 매니저가 문자열 배열(`VoteManagement.js:196`)로만 저장하므로 실사용 경로는 아닙니다.

### [확정3] `redeem_coupon` 관리자 승인 게이트 → **필요합니다. 단 화면 위치가 회신과 다릅니다**

**운영 방식**: 매장 직원이 **고객의 휴대폰(=고객 앱)을 받아서** 관리자 비밀번호를 직접
입력하고 사용 처리합니다. 승인 화면은 고객 앱에 있습니다.

```js
// src/screens/ticket/TicketScreen.js:127-151 — 비밀번호 입력란이 고객 앱에 있음
setSelectedCouponId(coupon.id); setPassword('');
() => couponService.useCoupon(coupon.id, password)
```

즉 회신 §1의 **"승인 화면을 매니저 앱에 두고 매니저가 admin 경로로 처리"는
이 제품의 운영 흐름과 맞지 않습니다.** 고객이 자기 폰에서 쿠폰을 띄우고 직원이
그 자리에서 비밀번호를 넣는 방식이라, 매니저 앱을 따로 열게 하면 응대 동선이 무너집니다.

**"비밀번호 검증을 DB가 아니라 Edge Function으로 올린다"는 원칙에는 동의합니다.**
바뀌는 것은 검증 위치가 아니라 호출 주체입니다 — 매니저 앱이 아니라 고객 앱이 호출합니다.

#### 제안 설계

```
고객 앱 (anon 키)
  └─ POST /functions/v1/redeem-coupon  { session_token, coupon_id, admin_password }
       └─ Edge Function
            1. admin_password 를 ADMIN_PASSWORD_SHA256 과 상수시간 비교
               (admin-login 이 쓰는 시크릿을 그대로 재사용 — 새 시크릿 불필요)
            2. service_role 로 redeem_coupon_internal(coupon_id, session_token) 호출
                 └─ 세션 검증 + 소유권 + 만료 + is_used + customers.coupons 차감
                    anon/authenticated 에서 REVOKE (Edge Function 경유만 허용)
```

- DB에 공유 관리자 비밀번호를 두지 않습니다 (`app_configs`·GUC 모두 불필요)
- 클라이언트가 게이트를 우회할 수 없습니다 — 내부 RPC가 anon 에 노출되지 않음
- `admin-login` 과 같은 시크릿을 쓰므로 관리자 비밀번호 변경 지점이 하나로 유지됩니다

**확인된 전제**
- `admin-login` Edge Function 배포 확인 (GET → 405). 시크릿이 이 프로젝트에 이미 존재
- `ai-proxy/index.ts:289-302` 에 동일 패턴(service_role + `createClient` + `rpc`)이 이미 있음

**매니저에게 요청**
1. 위 설계에 이견 없으신지 확인 부탁드립니다. 이견 없으면 **유저앱이 Edge Function과
   내부 RPC를 구현**하겠습니다 (회신에서 "매니저가 RPC를 신설하겠다"고 하셨는데,
   호출 주체가 고객 앱이므로 유저앱이 맡는 편이 자연스럽습니다)
2. Edge Function 배포 권한이 유저앱에 없습니다. 배포를 매니저가 해주실지,
   유저앱에 권한을 주실지 정해 주세요
3. **브루트포스 방어 위치** — 고객 앱에서 호출되므로 앱을 가진 누구나 관리자 비밀번호를
   반복 시도할 수 있습니다. Edge Function 단에서 IP·세션 단위 레이트리밋이 필요합니다.
   `login_attempt_tracker` 를 재사용할지 별도 테이블을 둘지 의견 주세요

#### ⚠️ 그와 별개로 — `use_my_coupon` 이 운영에 배포돼 있지 않습니다

```
POST /rest/v1/rpc/use_my_coupon  →  404 PGRST202
"Could not find the function public.use_my_coupon(p_coupon_id, p_session_token)"
```

정본 `SupabaseSQL.sql:540` 에 정의와 `:659` GRANT 가 있는데 실 DB에 없습니다.
**매니저 정본도 운영에 완전히 적용된 상태가 아닙니다.** 회신 §10의 드리프트 우려가
매니저 쪽에서도 현실화돼 있는 것으로 보입니다. 확인 부탁드립니다.

위 설계는 `use_my_coupon` 에 의존하지 않으므로 이 건과 무관하게 진행 가능합니다.
다만 매니저가 `use_my_coupon` 을 배포하실 거라면 `redeem_coupon_internal` 이 그걸
호출하는 형태로 맞추겠습니다 — 로직 중복을 피하는 쪽이 낫습니다. 알려주세요.

#### ⚠️ 현재 쿠폰 사용이 죽어 있을 가능성

배포된 `redeem_coupon` 은 GUC 버전이 확정적이고(`app_configs` 부재), GUC 설정 여부는
anon 으로 확인이 불가능합니다. `app.admin_password_hash` / `app.admin_password` 중
어느 것도 세팅돼 있지 않다면 **모든 쿠폰 사용이 `invalid_admin_password` 로 실패합니다.**
매장에서 최근 쿠폰 사용에 성공한 적이 있는지 알려주시면 즉시 판단됩니다.

### [협의6] N7 강제 비밀번호 변경 플로우 → **방향 동의, 설계 협의 요청**

`123456` 하드코딩 + 세션 선발급 조합이 계정 탈취 경로라는 분석에 동의합니다.
제안하신 2번(변경 전용 단기 토큰)이 유저앱 로그인 플로우 변경을 수반하므로,
아래를 확정해 주시면 유저앱 쪽 작업을 시작하겠습니다.

1. `login_customer`가 `must_change_password = true`일 때 반환할 **응답 스키마** —
   `session_token` 대신 `change_token`을 주는 형태인지, 필드명은 무엇인지
2. 변경 전용 토큰을 받는 **RPC 시그니처** — 기존 `update_my_password(p_session_token, ...)`를
   재사용할지, 별도 `complete_forced_password_change(p_change_token, new_password)`를 만들지
3. 변경 성공 시 **정식 세션 발급 주체** — 그 RPC가 바로 세션을 반환하는지,
   유저앱이 `login_customer`를 다시 호출하는지

현재 유저앱은 `MainNavigator.js:145`에서 `must_change_password` 플래그를 보고
`ForcedPasswordChange` 화면으로 보내는 구조라, 위 3개만 정해지면 교체는 어렵지 않습니다.

---

## 3. ⚠️ [공유5] 감사 스크립트 결과 — **유저앱은 실행할 수 없습니다**

회신에서 1·5·7·9·10번 섹션 결과를 4곳에서 요청하셨고 "착수 전 필수"로 잡으셨는데,
**유저앱에는 이걸 실행할 자격증명이 없습니다.** 진행이 여기서 막힙니다.

| 필요한 것 | 유저앱 보유 여부 |
|---|---|
| `service_role` 키 | ❌ 없음 |
| DB 비밀번호 / `DATABASE_URL` | ❌ 없음 |
| `SUPABASE_ACCESS_TOKEN` (Management API) | ❌ 없음 |
| `psql` / Supabase CLI 링크 | ❌ 미설치 |
| anon 키 | ✅ 있음 (`pg_proc`·`pg_constraint` 접근 불가) |

`db_integrity_audit.sql`은 카탈로그를 읽어야 해서 anon으로는 한 줄도 못 돌립니다.

**요청**: 다음 중 하나를 선택해 주세요.
- **(A) 권장** — 매니저가 직접 실행. `supabase/tests/db_integrity_audit.sql`을 그대로
  Supabase SQL 에디터에 붙여 넣으면 됩니다. 읽기 전용입니다.
- (B) 유저앱에 `service_role` 키나 DB 접속 정보를 전달 → 유저앱이 실행 후 공유
- (C) 매니저가 결과만 덤프해서 전달

어느 쪽이든 **매니저 쪽에서 한 번은 실행해야 합니다.** (A)가 가장 빠릅니다.

### 지금 공유 가능한 것 — anon probe 결과 (2026-07-28, `gvoedaagemotwuzmfxfe`)

카탈로그 없이 확인 가능한 범위입니다. `node supabase/tests/probe_rpc_surface.mjs`

| 대상 | 결과 |
|---|---|
| `app_configs` | 없음 (PGRST205) |
| `verify_admin_password` | 없음 (PGRST202) |
| uuid 기반 RPC 5개 | **5/5 anon 호출 가능** (22P02) — §2 IDOR 실측 |
| `redeem_coupon(int,text,text)` | 존재, `invalid_session` 정상 |
| `delete_my_account(text,text)` | 존재, 무효 세션 정상 거부 |
| `customers`/`visit_history`/`ai_guest_sessions` | anon 차단 정상 |
| `notices` | anon 읽기 허용 정상 |

---

## 4. 나머지 항목에 대한 응답

| # | 매니저 결정 | 유저앱 응답 |
|---|---|---|
| 3 | `000-0000-0000` 치환 승인, `nickname`/`birthday` NULL도 요청 | **동의.** 단 아래 순서 주의 참고 |
| 4 | `login_customer` 빈 비밀번호 방어 — 매니저 수정 | 동의. 유저앱 작업 없음 확인 |
| 5-1 | `use_my_coupon`에 만료 검사 있음 | **정정 수용.** 유저앱 `redeem_coupon` 거취가 [확정3]에 달려 있어, 존치 시 만료 검사를 넣겠습니다 |
| 5-2 | `coupons` = 미사용 쿠폰 행 수, 유저앱도 차감 | 동의. [확정3] 이후 반영 |
| 5-3 | **트리거 금지**, 매니저가 RPC로 원자화 | **동의.** 트리거 제안 철회합니다. 매니저 클라이언트가 원인이라는 분석 수용 |
| 6 | CHECK `NOT VALID` 선행 + RPC 검증 강화 | 동의. 0-based 확정은 위 [확정4] |
| 7 | ASCII 코드 4종 통일 | **동의.** 4종으로 충분합니다. 매니저가 CHECK·마이그레이션 완료하면 유저앱 클라이언트를 코드값 전송으로 바꾸겠습니다 (`SettingReportManager.js:12`, `BugReportScreen.js:31`) |
| 8 | 로드맵 없음 → 삭제 | **완료** (위 §1) |
| 9-1 | pg_cron 일 1회 04:00 KST | 동의. `cleanup_ai_guest_sessions()`도 같은 잡에 넣어 주세요 (유저앱이 이미 추가, 운영자 전용) |
| 9-2 | 락아웃 DoS 🔴 재분류 | **동의.** 심각도 상향 수용 |
| 10 | `last_visit` 현행 유지 | **동의.** "방문 없음"과 "가입일 방문"이 구분 불가해진다는 지적이 맞습니다 |
| N1~N6 | 매니저 처리 | 확인. N4 닉네임 절단은 유저앱이 수정 UI를 붙일 때 `left(trim(...), 20)` 적용하겠습니다 |

### ⚠️ 3번 익명화 — 순서 주의

유저앱은 이미 `delete_my_account(text, text)`에서 **`phone_number` 접미사 부착을 제거**했습니다
(`20260728120000`). `varchar(13)` 초과로 탈퇴가 100% 실패하던 걸 먼저 막은 것이라,
**현재는 번호를 그대로 보존**합니다.

익명화(`000-0000-0000` + `nickname`/`birthday` NULL)는 회신에서 승인받았으니 유저앱이
이어서 넣겠습니다. 다만 매니저의 `delete_my_account(uuid)`가 DROP되기 전까지는
**두 경로의 동작이 다릅니다.** DROP 완료를 알려주시면 익명화 마이그레이션을 올리겠습니다.
(먼저 올려도 무방하지만, uuid 경로가 살아 있는 동안은 그쪽 탈퇴가 여전히 22001로 실패합니다.)

---

## 5. 다음 액션

| 순서 | 작업 | 담당 | 상태 |
|---|---|---|---|
| 1 | IDOR `CREATE`/`GRANT` 삭제 + REVOKE | 유저앱 | ✅ 완료 |
| 2 | IDOR 5개 `DROP` | 매니저 | 대기 — 진행하셔도 됩니다 |
| 3 | 감사 스크립트 실행 | **매니저** | ⚠️ 유저앱 실행 불가, §3 참고 |
| 4 | `redeem_coupon` 게이트 필요 여부 확정 | 유저앱 | 담당자 확인 중 |
| 5 | N7 플로우 3개 항목 확정 | 매니저 | 회신 요청 |
| 6 | 탈퇴 익명화 | 유저앱 | 매니저 DROP 후 |
| 7 | `report_type` 코드값 전환 | 유저앱 | 매니저 마이그레이션 후 |

---

## 부록 — 유저앱 변경 커밋

- `b7b511f` 탈퇴 실패 수정 + `cleanup_ai_guest_sessions` 추가
- `747f308` IDOR RPC 호출 코드 제거 (죽은 코드)
- `7c0d320` 1차 협의 문서 + `db_integrity_audit.sql`
- `249b704` 운영 probe 결과 + `probe_rpc_surface.mjs`
- 이번 커밋 — IDOR 정의/GRANT 삭제 + REVOKE 마이그레이션, 사본 삭제, `createVisit`/`updateVisit` 정리
