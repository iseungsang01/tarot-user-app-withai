# 유저앱 요청 (7차) — 보안 점검 결과: 공유 함수 수정 요청 + 유저앱 단독 변경 적용 요청

작성일: 2026-10-08 · 작성: 유저앱(tarot-user-app-withai)

런칭 전 보안 점검을 했습니다. 유저앱 단독 소유 객체는 유저앱에서 고쳤고(§1, 운영 적용 필요),
양쪽이 함께 정의하는 함수는 소유권 규칙대로 여기 적어 드립니다(§2~§5).
§2 는 런칭 전에 꼭 막아야 하는 건입니다.

---

## 1. 운영 적용 요청 — 유저앱 단독 객체 (마이그레이션 1개 + Edge Function 재배포)

`supabase/migrations/20261008120000_ai_proxy_server_side_quota.sql`

| 객체 | 변경 |
| --- | --- |
| `ai_proxy_rate_counters` (신규 테이블) | 고정 창 사용량 카운터. RLS on, anon/authenticated 접근 없음 |
| `hit_ai_rate_counter` (신규) | 내부 헬퍼. 모든 클라이언트 롤에서 회수 |
| `consume_ai_proxy_quota` (신규) | `service_role` 전용. 사용자 분당 6회 / 일 60회(게스트 20회), IP 분당 30회, 게스트 전체 일 2000회 |
| `issue_ai_guest_session` | IP당 시간당 10회, 전체 시간당 300회 발급 한도 추가 |
| `resolve_ai_proxy_session` | anon/authenticated 에서 EXECUTE 회수, `service_role` 만 |

**왜:** AI 프롬프트(system 포함)를 앱이 통째로 보내고 있었고, `issue_ai_guest_session` 은
anon 에 무제한 공개였습니다. 그래서 RPC 한 번으로 게스트 토큰을 받으면 우리 Google 키로
아무 프롬프트나 돌릴 수 있었고, 한도는 Edge isolate 메모리에만 있어 사실상 없었습니다.
이제 프롬프트는 ai-proxy 서버에서 만들고(`supabase/functions/ai-proxy/tasks.ts`),
사용량은 DB 에서 셉니다.

**적용 순서:** 마이그레이션 → `supabase functions deploy ai-proxy` → 앱 배포.
새 ai-proxy 는 `consume_ai_proxy_quota` 가 없으면 502 를 냅니다. 구버전 앱(≤1.0.8)의
AI 기능은 새 ai-proxy 에서 400 이 됩니다 — 런칭 전이라 하위호환은 두지 않았습니다.

`ai-proxy` 의 `AI_PROXY_REQUIRE_AUTH`, `SUPABASE_ANON_KEY` 시크릿은 더 이상 읽지 않으니 지우셔도 됩니다.

---

## 2. 🔴 `login_customer` — 기기 지문을 바꿔 가며 비밀번호를 무제한 대입할 수 있습니다

6차에서 락아웃 DoS 를 막으려고 잠금을 `(phone_hash, ip_device_hash)` 단위로만 보도록 했는데,
`ip_device_hash` 의 재료인 `p_client_fingerprint` 는 **클라이언트가 보내는 임의 문자열**입니다
(앱은 `전화번호::타임존`을 보냄). 공격자가 요청마다 지문을 바꾸면 잠금이 영원히 안 걸립니다.
`'__phone__'` 행은 6차 합의대로 관측용이라 잠그지 않습니다.

여기에 비밀번호 최소 길이가 1자(`validate_password_complexity`)라, 공개된 전화번호
하나로 짧은 비밀번호 계정은 온라인 대입으로 뚫립니다.

**제안 (DoS 방지 합의는 유지):**

1. 기기 키를 클라이언트 값 대신 **서버가 보는 IP** 로 바꿉니다. 피해자와 공격자 IP 가
   다르므로 6차의 DoS 우려가 되살아나지 않습니다.
   ```sql
   v_headers json := NULLIF(current_setting('request.headers', true), '')::json;
   v_client_ip text := COALESCE(
     NULLIF(btrim(v_headers ->> 'cf-connecting-ip'), ''),
     NULLIF(btrim(split_part(COALESCE(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
     'unknown');
   v_device_hash text := encode(extensions.digest(v_client_ip, 'sha256'), 'hex');
   ```
   (`p_client_fingerprint` 는 시그니처 호환을 위해 받기만 하고 쓰지 않음)
2. IP 를 여러 개 쓰는 공격의 상한으로, `'__phone__'` 행에 **느슨한 전역 상한**을 둡니다.
   예: 24시간 실패 50회 → 1시간 잠금. 피해자가 겪는 최악은 하루 몇 시간 잠금이고,
   공격자는 하루 50회밖에 못 시도합니다.
3. 비밀번호 최소 길이: 완화 결정은 존중하지만 4자 이상(신규 가입·변경에만)을 검토 부탁드립니다.
   1자 비밀번호는 위 1·2를 해도 10회 안쪽에 뚫립니다.

유저앱은 함수가 바뀌어도 수정할 것이 없습니다(응답 형식 동일).

---

## 3. 🟠 `register_customer` — 내부 오류 문구를 그대로 돌려줍니다

`EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'message', SQLERRM);`
— 제약 이름·컬럼 정보가 anon 에게 노출됩니다. 고정 문구로 바꾸고 원인은 `RAISE LOG` 로
남기는 것을 제안합니다. 유저앱은 `message` 를 파싱하지 않으니 바꿔도 영향 없습니다.

가입 RPC 자체에도 한도가 없어 계정을 대량 생성할 수 있습니다. §2 의 IP 키와 같은 방식으로
IP당 시간당 가입 수 상한(예: 5회)을 두면 함께 막힙니다.

---

## 4. 🟡 `submit_bug_report` — 입력 크기 상한이 없습니다

`p_description`, `p_screenshot`, `p_device_info` 에 길이 제한이 없어 세션 하나로 큰 행을
무한히 쌓을 수 있습니다. 제안: description 5,000자, screenshot(URL/base64 여부 확인 필요)
상한, device_info 4KB, 그리고 회원당 하루 20건.

---

## 5. 🟡 투표 함수 — 작은 것 두 개

- `get_vote_summary(p_vote_id)` 는 비활성(`is_active = false`) 투표의 집계도 anon 에게 돌려줍니다.
  `votes.is_active` 조건을 붙이는 것을 제안합니다.
- `submit_vote_response` 는 선택지 번호의 **하한(0)** 만 보고 상한을 안 봅니다.
  존재하지 않는 선택지 번호가 집계에 섞일 수 있습니다.

---

## 유저앱 쪽에서 한 그 밖의 조치 (참고)

- ai-proxy: Google API 키를 URL 쿼리 대신 `x-goog-api-key` 헤더로, 내부 오류 문구 비노출,
  인증 해제 토글(`AI_PROXY_REQUIRE_AUTH`) 제거, 본문 64KB 상한.
- `npm run security-check` 가 커밋된 Google 키·service_role 키·개인키·`.env*` 파일을 막습니다.
