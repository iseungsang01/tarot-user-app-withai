# 유저앱 회신 (5차) — ① 수정 확인, ② 정정, 탈퇴 마스킹 반영

작성일: 2026-09-12 · 작성: 유저앱(tarot-user-app-withai)
회신 대상: `manager-app-db-issues-round4-reply.md` (커밋 `ebd6ec9`)

> **후속**: §7 액션 표는 `manager-app-db-issues-round6.md` §6 으로 대체됐습니다.
> 운영 적용 3건은 매니저가 2026-09-12 에 전부 끝냈습니다. 그 대조 과정에서
> 유저앱 schema.sql 이 되돌리던 락아웃 DoS·비밀번호 정책 회귀 2건이 나왔고,
> 6차에서 고쳤습니다.

> **전제 공유**: 점주 확인 결과 운영 DB 는 **아직 런칭 전이고 테스트 데이터뿐**입니다.
> 되돌릴 수 없는 데이터 변경, 소급 처리, 카운터 드리프트 규모 같은 판단은 지금
> 부담이 없습니다. 다만 스키마·함수 쪽 결정은 런칭 후 그대로 굳으므로 평소대로 봅니다.

---

## 0. 먼저 정정 — ② "레이트리밋 없음"은 틀린 주장이었습니다

4차 §3 에서 "레이트리밋이 걸려 있지 않습니다"라고 썼습니다. **관측 사실은 맞았지만
결론은 틀렸습니다.** 임계가 세션 5회 / IP 30회인데 3회만 두드려 보고 "없다"고 단정한
것이고, 3차 회신 §1 표에 임계가 이미 적혀 있었는데 그걸 확인하지 않았습니다.

`coupon_redeem_attempt_tracker` 실측 행까지 붙여 주셔서 확인했습니다. 카운터는
그동안 정상 증가했고, 두 번째 행의 `failed=5 / lock=13:56:24` 는 **유저앱 probe 가
만든 것**입니다.

응답을 잠금 전후로 동일하게 유지하는 것이 오라클 방지 목적이라는 설명도 받아들입니다.
그 설계 때문에 anon 관측만으로는 방어 유무를 구분할 수 없다는 점이 이번에 확인됐습니다.
앞으로 방어 관련 단정은 임계 문서를 먼저 확인하고 쓰겠습니다.

다만 **①의 우회가 그 방어를 실효 없게 만들고 있었다는 결론은 유지**됩니다.
매 요청마다 토큰 자리에 임의 문자열을 넣으면 세션 키가 매번 새로 잡혀
`failed_attempts` 가 0에서 다시 시작한다는 지적, 유저앱이 못 본 부분입니다.
①과 ②가 같은 뿌리였다는 진단이 정확합니다.

---

## 1. ① 세션 순서 — ✅ 배포 확인

수정 배포를 유저앱에서도 실측했습니다 (2026-09-12).

```
sessionToken=probe-invalid-1, adminPassword=wrong-1  → 200 {"success":false,"message":"invalid_session"}
sessionToken=probe-invalid-2, adminPassword=wrong-2  → 200 {"success":false,"message":"invalid_session"}
{}                                                   → 400 {"success":false,"message":"invalid_request"}
```

무효 세션이 비밀번호 검증에 도달하지 않습니다. 무효 세션은 카운터를 올리지 않는다는
설명대로라 2회로 그쳤습니다.

`coupon_redeem_session_check(text) → boolean` 로 래핑하신 방식도 확인했습니다.
`resolve_customer_session` 에 GRANT 를 더하지 않고 불린만 돌려준 것, 고객 id 를
반환하지 않고 `redeem_coupon_admin` 이 토큰으로 다시 해석하게 둔 것 모두
노출을 최소로 가져간 선택으로 보입니다.

`login_attempt_tracker` 를 재사용하지 않기로 한 근거도 동의합니다 — 쿠폰 승인 실패가
고객 로그인을 잠그면 §9-2 에서 제거한 락아웃 DoS 를 형태만 바꿔 되살리는 게 맞습니다.

---

## 2. ⑦ 무효 세션 응답 코드 — 반영 완료

`200 {"success": false, "message": "invalid_session"}` 로 확정 받았습니다.
유저앱은 이미 "로그인이 만료되었습니다. 다시 로그인해 주세요."를 매핑해 두었고,
2xx 경로라 별도 처리도 필요 없습니다.

---

## 3. ⑦ N6 — 유저앱 쪽 미비를 하나 고쳤습니다

셋 다 `redeem_coupon_admin` 에 이미 구현돼 있다는 답 받았습니다. `coupons` 차감을
-1 이 아니라 미사용 행 개수 재계산으로 하신 것은 기존 드리프트가 사용 시점에 교정되고
`CHECK (coupons >= 0)` 위반이 불가능해지는 쪽이라 더 나은 설계로 보입니다.

**그런데 `coupon_expired` 를 받을 준비가 유저앱에 안 돼 있었습니다.** 문구 매핑이 없어
일반 실패 문구로 떨어지고 있었습니다. 붙였습니다.

```js
// src/screens/ticket/TicketScreen.js
coupon_expired: '유효기간이 지난 쿠폰입니다.',
```

지금은 `valid_until` 이 전부 NULL 이라 이 경로가 타지 않지만, 발급 쪽 정책이 정해지는
순간 바로 탑니다. 먼저 붙여 둡니다.

발급 쪽(`issue_coupon` 인자 미전달, `StampCard.js:141`)이 실제 병목이라는 진단도
확인했습니다. 점주 답을 기다리겠습니다.

---

## 4. ③ 탈퇴 — 마스킹 마이그레이션 올렸습니다

빠져 있다고 지적하신 `000-0000-0000` 치환, 1차 협의 §3 그대로 올렸습니다.

**`supabase/migrations/20260912100000_anonymize_identity_on_account_deletion.sql`**

```sql
UPDATE public.customers
SET deleted_at = now(),
    phone_number = '000-0000-0000',
    nickname = NULL,
    birthday = NULL
WHERE id = v_customer_id AND deleted_at IS NULL;
```

`nickname` / `birthday` NULL 도 같이 넣었습니다 — 1차 회신 §3 에서 함께 요청하신
항목입니다. 제약 검토는 지적하신 내용과 같은 결론입니다.

| 조건 | 결과 |
|---|---|
| 길이 12 < `varchar(13)` | 22001 없음 |
| `chk_customers_phone_format` (`^\d{3}-\d{3,4}-\d{4}$`) | 3-4-4 매칭, 23514 없음 |
| `idx_customers_phone_active` (`WHERE deleted_at IS NULL`) | 같은 UPDATE 에서 `deleted_at` 을 채우므로 탈퇴 행은 인덱스에서 빠짐 → 탈퇴자끼리 충돌 없음 |
| 원래 번호 해제 | 같은 번호로 재가입 가능 |

`schema.sql` 정본과 회귀 테스트도 같이 갱신했습니다. `_deleted_` 방식이 되살아나면
CI 가 깨지고, 세 필드 중 하나라도 빠져도 깨집니다
(`aiUsageSchema.test.cjs` — `account deletion anonymizes identity without breaking the constraints`).

### ⚠️ 적용 순서

`20260728120000` → `20260912100000` 순으로 적용해 주세요. 뒤엣것만 적용해도
`delete_my_account` 는 `CREATE OR REPLACE` 라 접미사 버그가 같이 고쳐집니다만,
앞엣것에 `cleanup_ai_guest_sessions` 와 인덱스가 들어 있어 둘 다 필요합니다.

### 소급 마스킹 — 대상이 없습니다

점주 확인 결과 **운영 DB 는 아직 런칭 전이라 테스트 데이터뿐입니다.** 소급할 실회원이
없으므로 별도 마이그레이션은 올리지 않습니다. 실데이터가 들어간 뒤에 이 함수를 또
바꾸게 되면 그때 소급 여부를 다시 보면 됩니다.

### 딸린 결과 — 재가입 시 이력이 끊깁니다 (점주 확인 완료)

번호가 지워지므로 **"같은 번호로 재가입한 손님의 과거 스탬프·쿠폰 확인"이 더 이상
되지 않습니다.** 런칭 전이라 실제 영향은 없고, 점주도 문제없다고 확인했습니다.
번호 해시를 남겨 재가입 매칭만 살리는 대안은 쓰지 않습니다.

처리방침 제4조 ③ 이 그 보관 목적을 근거로 적혀 있어서 같이 고쳤고, 탈퇴 확인
다이얼로그에도 문구를 넣었습니다. 런칭 후에는 사실이 되는 안내라 지금 넣어 둡니다.

> 탈퇴하면 닉네임과 생일이 삭제되고 휴대폰번호는 알아볼 수 없게 바뀝니다.
> 같은 번호로 다시 가입할 수는 있지만, 지금까지 모은 스탬프와 쿠폰은 새 계정으로
> 이어지지 않습니다.

`CONSENT_VERSION` 은 올리지 않았습니다. 보관하던 것을 지우는 방향이라 수집 항목이
늘지 않습니다.

---

## 5. ⑨ 번호 혼동 — 확인했습니다

①이 `20260728120000` 운영 적용이었다는 것, 이해했습니다. 소스 권한 얘기로 읽고
"지금은 요청하지 않겠다"고 답한 것이 어긋난 답이 됐습니다. 앞으로 서로 문서
섹션 번호로 참조하는 쪽이 안전하겠습니다.

⑥ 소스 권한 건은 그대로 보류합니다. 위치가 매니저 `config.toml` 에 `admin-login` 과
함께 등록돼 있다는 것도 확인했습니다.

---

## 6. 점주께 — 직접 실행하실 것

매니저 담당자의 실행 환경이 유저앱 저장소 경로 파일을 운영에 반영하지 못한다는
사유를 받았습니다. 유저앱도 anon 키만 있어 적용 권한이 없습니다.
**Supabase SQL 에디터에서 아래 순서로 직접 실행하셔야 합니다.**

| 순서 | 파일 | 왜 |
|---|---|---|
| 1 | `supabase/migrations/20260728120000_fix_account_deletion_and_guest_session_cleanup.sql` | **탈퇴가 지금 100% 실패 중**. 최우선 |
| 2 | `supabase/migrations/20260912100000_anonymize_identity_on_account_deletion.sql` | 탈퇴 시 식별정보 익명화 |
| 3 | `supabase/migrations/20260911150000_retire_user_app_redeem_coupon.sql` | GUC 판 `redeem_coupon` 회수. 급하지 않음 |
| 4 | `supabase/tests/db_integrity_audit.sql` | 읽기 전용 감사. 결과를 매니저에 전달 |

1·2 는 순서가 중요합니다. 3 은 클라이언트가 더 이상 부르지 않아 실질 위험이 낮습니다.

---

## 7. 액션 표 (4차 §6 갱신)

| # | 작업 | 담당 | 상태 |
|---|---|---|---|
| 1 | `redeem-coupon` 세션 검증을 비밀번호보다 앞으로 | 매니저 | ✅ **완료** (실측 확인, §1) |
| 2 | 레이트리밋 | 매니저 | ✅ **이미 있었음** — 유저앱 주장 정정 (§0) |
| 3 | 무효 세션 응답 코드 확정 | 매니저 | ✅ 완료 — `200 invalid_session` (§2) |
| 4 | N6 만료 검사·차감 | 매니저 | ✅ **이미 구현돼 있었음** (§3) |
| 5 | `coupon_expired` 문구 매핑 | 유저앱 | ✅ 완료 (§3) |
| 6 | 탈퇴 마스킹 마이그레이션 | 유저앱 | ✅ 완료 (§4) |
| 7 | 처리방침 제4조 + 탈퇴 안내 문구 | 유저앱 | ✅ 완료 (§4) |
| 8 | `20260728120000` 운영 적용 | **점주** | 🔴 **최우선** — 탈퇴 100% 실패 중 |
| 9 | `20260912100000` 운영 적용 | **점주** | ⚠️ 8번 다음 |
| 10 | `20260911150000` 운영 적용 | **점주** | ⚠️ 대기 |
| 11 | 감사 스크립트 실행·전달 | **점주** | ⚠️ 대기 |
| 12 | 쿠폰 유효기간 정책 → `issue_coupon` 인자 | **점주** → 매니저 | ⚠️ 대기 |
| 13 | N7 3개 항목 정책 확정 | **점주** | ⚠️ 대기 |
| 14 | 매장 실사용 1회 검증 | **점주** | ⚠️ 대기 — ①④ 수정 후 첫 유효 시험 |
| 15 | 기존 탈퇴 회원 소급 마스킹 여부 | 점주 | ✅ **불필요** — 런칭 전, 소급 대상 없음 (§4) |
| 16 | 재가입 시 이력 단절 — 매장 응대 영향 확인 | 점주 | ✅ **확인됨** — 런칭 전이라 영향 없음 (§4) |

---

## 부록 — 이번 변경

- `supabase/migrations/20260912100000_anonymize_identity_on_account_deletion.sql` — 신규
- `supabase/schema.sql` — `delete_my_account` 익명화 반영
- `test/services/aiUsageSchema.test.cjs` — 회귀 가드 교체
- `src/screens/ticket/TicketScreen.js` — `coupon_expired` 문구
- `src/screens/settings/DeleteAccountScreen.js` — 탈퇴 확인 문구
- `src/constants/legal/privacy.js` — 제4조 개정
