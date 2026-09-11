const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.join(__dirname, '../../supabase/schema.sql');
const migrationsDir = path.join(__dirname, '../../supabase/migrations');

function readMigrations() {
  return new Map(
    fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => [name, fs.readFileSync(path.join(migrationsDir, name), 'utf8')]),
  );
}

function getFunctionBody(functionName) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${functionName}\\s*\\([\\s\\S]*?\\n\\$\\$;`,
    'm',
  );
  const match = schema.match(pattern);
  assert.ok(match, `${functionName} definition should exist in schema.sql`);
  return match[0];
}

test('coupon schema: redeem_coupon is retired and never re-exposed to clients', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const migrations = readMigrations();

  // 관리자 비밀번호 검증은 redeem-coupon Edge Function 시크릿으로 옮겼다.
  // DB 에 관리자 비밀번호를 읽는 RPC 가 다시 생기면 여기서 깨진다.
  // 근거: docs/manager-app-db-issues-round2.md §2 [확정3]
  assert.doesNotMatch(schema, /CREATE OR REPLACE FUNCTION public\.redeem_coupon/);
  assert.doesNotMatch(schema, /GRANT EXECUTE ON FUNCTION public\.redeem_coupon/);
  assert.doesNotMatch(schema, /current_setting\('app\.admin_password/);
  assert.doesNotMatch(schema, /CREATE OR REPLACE FUNCTION public\.use_my_coupon_with_admin_password/);
  assert.doesNotMatch(schema, /GRANT EXECUTE ON FUNCTION public\.use_my_coupon_with_admin_password/);

  // use_my_coupon 은 매니저 소유였고, 유저앱 schema.sql 의 이 DROP 이 운영에서
  // 404 PGRST202 를 만들었다. 2026-09-11 회신으로 재적용하지 않기로 확정돼 함수는
  // 앞으로 존재하지 않지만, 남의 네임스페이스를 지우는 문장을 다시 들이지 않는다.
  assert.doesNotMatch(schema, /DROP FUNCTION IF EXISTS public\.use_my_coupon\(/);

  // 되살리는 마이그레이션이 새로 들어오면 막는다. 과거 두 벌은
  // 20260911150000 이 뒤에서 정리하므로 예외로 둔다.
  const legacy = new Set(['20260601051045_baseline_app_schema.sql', '20260604042031_apply_integrated_schema.sql']);
  for (const [name, body] of migrations) {
    if (legacy.has(name)) continue;
    assert.doesNotMatch(body, /CREATE OR REPLACE FUNCTION public\.redeem_coupon/, `${name} must not recreate redeem_coupon`);
    assert.doesNotMatch(body, /GRANT EXECUTE ON FUNCTION public\.redeem_coupon/, `${name} must not re-grant redeem_coupon`);
  }

  // 정리 마이그레이션 자체가 사라지면 db reset 때 GUC 판이 되살아난다.
  const cleanup = migrations.get('20260911150000_retire_user_app_redeem_coupon.sql');
  assert.ok(cleanup, 'redeem_coupon 정리 마이그레이션이 있어야 한다');
  assert.match(cleanup, /DROP FUNCTION/);
  assert.match(cleanup, /REVOKE ALL ON FUNCTION/);
});

test('coupon schema: customer coupon lookup RPCs use session token ownership', () => {
  const listFunction = getFunctionBody('get_my_coupons');
  const countFunction = getFunctionBody('get_my_coupon_count');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  for (const functionBody of [listFunction, countFunction]) {
    assert.match(functionBody, /p_session_token text/);
    assert.match(functionBody, /p_valid_only boolean DEFAULT false/);
    assert.match(functionBody, /public\.resolve_customer_session\(p_session_token\)/);
    assert.match(functionBody, /ch\.customer_id = v_customer_id/);
    assert.match(functionBody, /ch\.is_used = false/);
    assert.match(functionBody, /ch\.valid_until IS NULL/);
    assert.match(functionBody, /ch\.valid_until >= now\(\)/);
    assert.match(functionBody, /SET search_path = public/);
  }

  assert.match(listFunction, /RETURNS SETOF public\.coupon_history/);
  assert.match(listFunction, /ORDER BY ch\.issued_at DESC/);
  assert.match(countFunction, /RETURNS integer/);
  assert.match(countFunction, /RETURN COALESCE\(v_count, 0\)/);
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.get_my_coupons\(text, boolean\) TO anon, authenticated;/);
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.get_my_coupon_count\(text, boolean\) TO anon, authenticated;/);
});

test('visit schema: customer visit lookup RPCs use session token ownership', () => {
  const listFunction = getFunctionBody('get_my_visits');
  const detailFunction = getFunctionBody('get_my_visit');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  for (const functionBody of [listFunction, detailFunction]) {
    assert.match(functionBody, /p_session_token text/);
    assert.match(functionBody, /public\.resolve_customer_session\(p_session_token\)/);
    assert.match(functionBody, /vh\.customer_id = v_customer_id/);
    assert.match(functionBody, /vh\.is_deleted = false/);
    assert.match(functionBody, /SET search_path = public/);
  }

  assert.match(listFunction, /ORDER BY vh\.visit_date DESC/);
  assert.match(detailFunction, /p_visit_id integer/);
  assert.match(detailFunction, /vh\.id = p_visit_id/);
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.get_my_visits\(text\) TO anon, authenticated;/);
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.get_my_visit\(text, integer\) TO anon, authenticated;/);
});

test('visit schema: customer deletion flag hides visits without removing admin records', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const hideFunction = getFunctionBody('hide_my_visit');

  assert.match(schema, /is_hidden_by_customer boolean NOT NULL DEFAULT false/);
  assert.match(schema, /idx_visit_history_customer_visible/);
  assert.match(schema, /WHERE is_deleted = false AND is_hidden_by_customer = false/);
  assert.match(hideFunction, /p_session_token text/);
  assert.match(hideFunction, /p_visit_id integer/);
  assert.match(hideFunction, /public\.resolve_customer_session\(p_session_token\)/);
  assert.match(hideFunction, /SET is_hidden_by_customer = true/);
  assert.match(hideFunction, /vh\.id = p_visit_id/);
  assert.match(hideFunction, /vh\.customer_id = v_customer_id/);
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.hide_my_visit\(text, integer\) TO anon, authenticated;/);
});

test('session schema: resolve_customer_session is defined and login issues session tokens', () => {
  const resolveFunction = getFunctionBody('resolve_customer_session');
  const loginFunction = getFunctionBody('login_customer');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  assert.match(schema, /CREATE TABLE IF NOT EXISTS public\.customer_sessions/);
  assert.match(schema, /token_hash text NOT NULL UNIQUE/);
  assert.doesNotMatch(schema, /customer_sessions \(\s*token text PRIMARY KEY/);
  assert.match(resolveFunction, /RETURNS uuid/);
  assert.match(resolveFunction, /FROM public\.customer_sessions/);
  assert.match(resolveFunction, /v_token_hash := encode\(extensions\.digest\(p_session_token, 'sha256'\), 'hex'\)/);
  assert.match(resolveFunction, /s\.token_hash = v_token_hash/);
  assert.doesNotMatch(resolveFunction, /s\.token = p_session_token/);
  assert.match(resolveFunction, /revoked_at IS NULL/);
  assert.match(resolveFunction, /expires_at > now\(\)/);
  assert.match(loginFunction, /INSERT INTO public\.customer_sessions \(customer_id, token_hash, expires_at, last_used_at\)/);
  assert.match(loginFunction, /extensions\.digest\(v_session_token, 'sha256'\)/);
  assert.match(loginFunction, /'session_token', v_session_token/);
});

test('session schema: AI guest sessions are server-issued and resolvable by the AI proxy only', () => {
  const issueFunction = getFunctionBody('issue_ai_guest_session');
  const resolveFunction = getFunctionBody('resolve_ai_proxy_session');
  const logoutFunction = getFunctionBody('logout_ai_guest_session');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  assert.match(schema, /CREATE TABLE IF NOT EXISTS public\.ai_guest_sessions/);
  assert.match(schema, /token_hash text NOT NULL UNIQUE/);
  assert.match(schema, /CREATE POLICY "No Direct Access ai_guest_sessions"/);
  assert.match(schema, /REVOKE ALL ON public\.ai_guest_sessions FROM anon, authenticated/);
  assert.match(issueFunction, /extensions\.gen_random_bytes\(32\)/);
  assert.match(issueFunction, /extensions\.digest\(v_session_token, 'sha256'\)/);
  assert.match(issueFunction, /'session_token', v_session_token/);
  assert.match(resolveFunction, /public\.resolve_customer_session\(p_session_token\)/);
  assert.match(resolveFunction, /FROM public\.ai_guest_sessions/);
  assert.match(resolveFunction, /'guest:' \|\| v_guest_session_id::text/);
  assert.match(logoutFunction, /SET revoked_at = now\(\)/);
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.issue_ai_guest_session\(\) TO anon, authenticated;/);
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.resolve_ai_proxy_session\(text\) TO anon, authenticated;/);
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.logout_ai_guest_session\(text\) TO anon, authenticated;/);
});

test('password schema: customer password change clears forced-change flag', () => {
  // uuid 판(update_customer_password)은 제거됐다. 세션 토큰판이 같은 역할을 한다.
  const functionBody = getFunctionBody('update_my_password');

  assert.match(functionBody, /SET password = extensions\.crypt\(new_password, extensions\.gen_salt\('bf'\)\),\s+must_change_password = false/);
});

test('account schema: uuid-keyed account RPCs are gone and never re-granted', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // 세션 검증 없이 anon 에 노출됐던 5개. 정의든 GRANT 든 하나라도 되살아나면
  // 스키마를 다시 적용하는 순간 매니저의 DROP 이 원복된다.
  const forbidden = [
    /CREATE OR REPLACE FUNCTION public\.update_my_nickname\s*\(\s*p_id uuid/,
    /CREATE OR REPLACE FUNCTION public\.delete_my_account\s*\(\s*p_id uuid/,
    /CREATE OR REPLACE FUNCTION public\.soft_delete_customer\s*\(/,
    /CREATE OR REPLACE FUNCTION public\.verify_password\s*\(\s*customer_uuid uuid/,
    /CREATE OR REPLACE FUNCTION public\.update_customer_password\s*\(\s*customer_uuid uuid/,
    /GRANT EXECUTE ON FUNCTION public\.update_my_nickname\(uuid, text\)/,
    /GRANT EXECUTE ON FUNCTION public\.delete_my_account\(uuid\)/,
    /GRANT EXECUTE ON FUNCTION public\.soft_delete_customer\(uuid\)/,
    /GRANT EXECUTE ON FUNCTION public\.verify_password\(uuid, text\)/,
    /GRANT EXECUTE ON FUNCTION public\.update_customer_password\(uuid, text, text\)/,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(schema, pattern);
  }

  // 대체 경로는 남아 있어야 한다.
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.verify_my_password\(text, text\) TO anon, authenticated;/);
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.update_my_password\(text, text, text, text\) TO anon, authenticated;/);
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.delete_my_account\(text, text\) TO anon, authenticated;/);
});

test('coupon schema: direct coupon mutations are denied to client roles', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');

  assert.doesNotMatch(schema, /CREATE POLICY "Allow All (Insert|Update|Delete)" ON coupon_history/);
  assert.doesNotMatch(schema, /CREATE POLICY "Coupon history owner (insert|update|delete)" ON coupon_history/i);
  assert.match(schema, /CREATE POLICY "Admin can manage coupon_history"/);
  assert.match(schema, /ON public\.coupon_history[\s\S]*?USING \(public\.is_admin\(\)\)[\s\S]*?WITH CHECK \(public\.is_admin\(\)\)/);
});


test('account schema: sensitive operations resolve customer from session token', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const functionBodies = [
    getFunctionBody('verify_my_password'),
    getFunctionBody('update_my_password'),
    schema.match(/CREATE OR REPLACE FUNCTION public\.delete_my_account\(p_session_token text, input_password text\)[\s\S]*?\n\$\$;/)[0],
  ];

  for (const functionBody of functionBodies) {
    assert.match(functionBody, /p_session_token text/);
    assert.match(functionBody, /public\.resolve_customer_session\(p_session_token\)/);
    assert.doesNotMatch(functionBody, /customer_uuid uuid/);
  }
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.verify_my_password\(text, text\) TO anon, authenticated;/);
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.update_my_password\(text, text, text, text\) TO anon, authenticated;/);
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.delete_my_account\(text, text\) TO anon, authenticated;/);
});

test('account schema: account deletion anonymizes identity without breaking the constraints', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const deleteAccount = schema.match(
    /CREATE OR REPLACE FUNCTION public\.delete_my_account\(p_session_token text, input_password text\)[\s\S]*?\n\$\$;/,
  )[0];

  // 1차 협의 §3 에서 승인받은 익명화. 셋 다 빠지면 탈퇴자의 식별정보가 남는다.
  assert.match(deleteAccount, /phone_number = '000-0000-0000'/);
  assert.match(deleteAccount, /nickname = NULL/);
  assert.match(deleteAccount, /birthday = NULL/);
  assert.match(deleteAccount, /SET deleted_at = now\(\)/);

  // '_deleted_' 접미사는 varchar(13) 초과로 탈퇴를 100% 실패시켰던 방식이다.
  // 되살아나면 여기서 깨진다. 주석은 그 방식을 설명하느라 문자열을 담고 있어 걷어낸다.
  const statements = deleteAccount.replace(/^\s*--.*$/gm, '');
  assert.doesNotMatch(statements, /_deleted_/);

  // 익명화가 성립하려면 이 두 가지가 같이 있어야 한다 — 12자가 들어갈 폭과,
  // 탈퇴 행끼리 같은 번호로 충돌하지 않게 해 주는 부분 유니크 인덱스.
  assert.match(schema, /phone_number varchar\(13\)/);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_active[\s\S]*?WHERE deleted_at IS NULL/);

  // 000-0000-0000 이 CHECK 를 통과하는지 정규식으로 직접 확인한다.
  const check = schema.match(/CONSTRAINT chk_customers_phone_format CHECK \(phone_number ~ '([^']+)'\)/);
  assert.ok(check, 'phone format CHECK 가 있어야 한다');
  assert.match('000-0000-0000', new RegExp(check[1]));
  assert.ok('000-0000-0000'.length <= 13);
});

test('guest session schema: expired AI guest sessions are purgeable', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const cleanup = getFunctionBody('cleanup_ai_guest_sessions');

  assert.match(cleanup, /DELETE FROM public\.ai_guest_sessions/);
  assert.match(cleanup, /expires_at < now\(\) - p_retention/);
  assert.match(schema, /CREATE INDEX IF NOT EXISTS idx_ai_guest_sessions_expires_at/);
  // 정리 함수는 운영자 전용이라 클라이언트 롤에 노출되면 안 된다.
  assert.match(schema, /REVOKE ALL ON FUNCTION public\.cleanup_ai_guest_sessions\(interval\) FROM PUBLIC, anon, authenticated;/);
  assert.doesNotMatch(schema, /GRANT EXECUTE ON FUNCTION public\.cleanup_ai_guest_sessions/);
});
