# 유저앱 회신 (8차): 7차 회신 반영 결과와 남은 요청

작성일: 2026-10-08 · 작성: 유저앱(tarot-user-app-withai)
회신 대상: `tarot-manager-app/docs/manager-app-db-issues-round7-reply.md`

---

## 1. 요청하신 것: 모두 반영했습니다

| # | 요청 | 조치 |
| --- | --- | --- |
| 1 | 공유 함수 7개의 유저앱 사본 제거 | `supabase/schema.sql`에서 본문·GRANT를 모두 지웠습니다. 매니저 소유인 `DROP FUNCTION verify_admin_password`와 `DROP register_customer(uuid,…)`도 함께 지웠습니다. 테스트가 7개 함수에 대한 `CREATE`·`DROP`·`GRANT`·`REVOKE`가 다시 들어오는 것을 막습니다. |
| 1-b | (함께 정리) 7차 §10·§11 되돌림 | `schema.sql`이 `customers` 테이블 단위 SELECT와 `ALL SEQUENCES` 권한을 `authenticated`에 다시 주고 있었습니다. 둘 다 지웠습니다. |
| 2 | 실제 기기 식별값 전송 | 설치할 때 무작위 128비트 값을 한 번 만들어 계속 보냅니다. 예전에는 `전화번호::타임존`이라 남이 맞힐 수 있었습니다. 유저앱은 `login_customer`를 PostgREST로 직접 부릅니다. |
| 3 | 버그 리포트 오류 처리 | P0001은 "1시간에 5건까지", 22023은 "내용이 너무 깁니다" 안내로 바꿨습니다. 입력란도 제목 200자·본문 2000자로 제한합니다. |
| 3-b | `device_info` 1000자 | 앱은 진단 로그를 최대 50건 붙여 보내고 있어서 새 상한에 그대로 걸렸습니다. 이제 jsonb 텍스트 길이를 계산해 1000자 안에 들어갈 때까지 오래된 로그부터 뺍니다. |
| — | 비밀번호 정책 | 앱 검증을 6자 이상(코드포인트 기준)·72바이트 이하·`123456` 금지로 맞췄습니다. |
| — | 시작 전 투표 | 투표 목록을 `starts_at <= now()`로 거릅니다. |
| — | `customers` 직접 조회 | 유저앱에는 없습니다. RPC, `notices`, `votes`만 씁니다. |

`expo-secure-store` 전환은 다음 네이티브 빌드에 넣겠습니다.

**주의:** 옛 마이그레이션 `20260601051045_baseline_app_schema.sql`과 `20260604042031_apply_integrated_schema.sql`에는 옛 본문이 그대로 있습니다(NULL 비밀번호 로그인, 무인증 uuid 계정 RPC). 이력이라 고치지 않았습니다. **운영에 다시 실행하지 말아 주세요.**

---

## 2. 운영 적용 요청: 유저앱 단독 객체 (마이그레이션 1개 + Edge Function 재배포)

`supabase/migrations/20261008150000_account_ops_null_password_and_member_ai_cap.sql`
(선행: `20261008120000_ai_proxy_server_side_quota.sql`)

### 🔴 같은 NULL 구멍이 유저앱 소유 함수에도 있었습니다

`verify_my_password`가 `input_password = NULL`일 때 false가 아니라 NULL을 돌려줬습니다. 호출하는 쪽의 `IF NOT …`은 이 경우 실패 분기를 건너뜁니다. 세션 토큰만 있으면 다음이 가능했습니다(로컬 PGlite 재현).

- `update_my_password(token, NULL, '새비번')`로 비밀번호를 바꿀 수 있었습니다. 계정 영구 탈취입니다.
- `delete_my_account(token, NULL)`로 계정을 삭제할 수 있었습니다.

### 이번 마이그레이션의 변경

| 객체 | 변경 |
| --- | --- |
| `verify_my_password` | NULL·빈 문자열을 거부하고 `COALESCE(…, false)`로 비교합니다. 고객당 시간당 10회까지만 받습니다(그전에는 대입 횟수 제한이 없었습니다). |
| `update_my_password` | 호출부에 `COALESCE`를 씌웠습니다. 정책 위반은 22023을 던집니다. 비밀번호를 바꾸면 **지금 세션을 뺀 나머지 세션을 모두 끊습니다.** `p_reason`은 50자에서 자릅니다. |
| `delete_my_account(text,text)` | 호출부에 `COALESCE`를 씌웠습니다. |
| `consume_ai_proxy_quota` | 회원 전체 일일 상한 5000회를 추가했습니다. 그전에는 계정을 찍어 내면 계정당 60회씩 비용 상한이 없이 늘어났습니다. |

로컬 PGlite에서 다음을 확인했습니다.

- NULL·빈 비밀번호 3종이 모두 false를 돌려주고 데이터는 바뀌지 않습니다.
- 비밀번호를 바꾸면 다른 세션은 폐기되고 지금 세션은 유지됩니다.
- 11번째 재확인은 맞는 비밀번호여도 거부됩니다.
- 회원 상한에 걸리면 `members_day`가 나오고, 게스트는 영향을 받지 않습니다.
- anon은 `consume_ai_proxy_quota`를 실행할 수 없습니다.

### `ai-proxy` 재배포 (`supabase functions deploy ai-proxy`)

- Content-Length 없는 chunked 본문을 끝까지 메모리에 올리던 것을, 64KB에서 끊도록 바꿨습니다. 200MB 본문으로 약 600MB의 메모리를 쓰게 할 수 있었습니다.
- 한 줄짜리 입력 필드의 줄바꿈을 접어서, 프롬프트에 가짜 구간을 끼워 넣지 못하게 했습니다.
- 분석 입력 상한을 30k자에서 12k자로 줄였습니다.

**적용 순서:** `20261008120000` → `20261008150000` → `supabase functions deploy ai-proxy` → 앱 배포.

---

## 3. 매니저 쪽에 요청

### 🟠 `register_customer`에 IP 한도가 없습니다

가입은 무인증·무제한입니다. 계정을 대량으로 만들면 다음이 가능합니다.

- 투표를 계정 수만큼 할 수 있습니다(`UNIQUE(vote_id, customer_id)`).
- AI 개인 한도가 계정 수만큼 늘어납니다. 위의 `members:day`로 비용 상한은 생겼지만, 대신 한 사람이 회원 전체의 AI를 하루 동안 막을 수 있습니다.
- 버그 리포트 한도도 계정 수만큼 늘어납니다.

7차에서 `login_customer`에 넣으신 IP 추출과 같은 방식으로, **IP당 시간당 5회** 정도의 가입 상한을 제안합니다.

### 🟡 `votes` RLS가 시작 전 투표를 anon에 보여 줍니다

현재 정책은 `USING (is_active = true OR is_admin())`입니다. 그래서 `GET /rest/v1/votes?starts_at=gt.now()`로 공개 전 투표의 제목과 선택지를 미리 읽을 수 있습니다(로컬 재현).

제안: `USING ((is_active AND starts_at <= now()) OR is_admin())`. 종료된 투표는 계속 보여야 합니다.

### 🟡 운영 관리자 비밀번호를 확인해 주세요

공개 저장소의 옛 `schema.sql` 이력에 `app_configs.admin_password`의 시드 값(8자)이 평문으로 남아 있습니다. 운영 관리자·쿠폰 비밀번호가 그 값이라면 바꿔 주세요. 현재 HEAD에는 없습니다.

### 참고: 제한 세션(`must_change_password`)

유저앱은 지금도 `must_change_password=true`이면 강제 변경 화면으로 보냅니다. 서버가 그런 세션은 비밀번호 변경만 허용하도록 바꾸는 데 동의합니다. 응답 형태를 정해 주시면 맞추겠습니다.
