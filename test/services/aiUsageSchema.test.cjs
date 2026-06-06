const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.join(__dirname, '../../supabase/schema.sql');

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

test('coupon schema: redeem_coupon validates session and admin password before atomic redemption', () => {
  const functionBody = getFunctionBody('redeem_coupon');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  assert.match(functionBody, /p_coupon_id integer/);
  assert.match(functionBody, /p_admin_password text/);
  assert.match(functionBody, /p_session_token text/);
  assert.match(functionBody, /RETURNS TABLE\(success boolean, message text\)/);
  assert.match(functionBody, /RETURN QUERY SELECT false, 'invalid_session'::text/);
  assert.match(functionBody, /extensions\.crypt\(p_admin_password,\s*v_config_hash\)/);
  assert.match(functionBody, /current_setting\('app\.admin_password_hash', true\)/);
  assert.match(functionBody, /current_setting\('app\.admin_password', true\)/);
  assert.match(functionBody, /FOR UPDATE/);
  assert.match(functionBody, /RETURN QUERY SELECT false, 'coupon_not_found'::text/);
  assert.match(functionBody, /RETURN QUERY SELECT false, 'coupon_already_used'::text/);
  assert.match(functionBody, /RETURN QUERY SELECT true, 'ok'::text/);
  assert.match(functionBody, /UPDATE public\.coupon_history/);
  assert.match(functionBody, /SET search_path = public, extensions/);
  assert.ok(
    functionBody.indexOf('public.resolve_customer_session(p_session_token)') <
      functionBody.indexOf("current_setting('app.admin_password_hash', true)"),
    'customer session should be resolved before admin password verification',
  );
  assert.doesNotMatch(schema, /CREATE OR REPLACE FUNCTION public\.use_my_coupon_with_admin_password/);
  assert.doesNotMatch(schema, /GRANT EXECUTE ON FUNCTION public\.use_my_coupon_with_admin_password/);
  assert.match(schema, /GRANT EXECUTE ON FUNCTION public\.redeem_coupon\(integer, text, text\) TO anon, authenticated;/);
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
  const functionBody = getFunctionBody('update_customer_password');

  assert.match(functionBody, /SET password = extensions\.crypt\(new_password, extensions\.gen_salt\('bf'\)\),\s+must_change_password = false/);
});

test('coupon schema: direct coupon mutations are denied to client roles', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');

  assert.doesNotMatch(schema, /CREATE POLICY "Allow All (Insert|Update|Delete)" ON coupon_history/);
  assert.doesNotMatch(schema, /CREATE POLICY "Coupon history owner (insert|update|delete)" ON coupon_history/i);
  assert.match(schema, /CREATE POLICY "Admin can manage coupon_history"/);
  assert.match(schema, /ON public\.coupon_history[\s\S]*?USING \(public\.is_admin\(\)\)[\s\S]*?WITH CHECK \(public\.is_admin\(\)\)/);
});
