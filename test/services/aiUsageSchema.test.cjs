const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.join(__dirname, '../../supabase/schema.sql');

function getFunctionBody(functionName) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${functionName}[\\s\\S]*?\\n\\$\\$;`,
    'm',
  );
  const match = schema.match(pattern);
  assert.ok(match, `${functionName} definition should exist in schema.sql`);
  return match[0];
}

test('coupon schema: admin password and coupon redemption are bound in one RPC', () => {
  const functionBody = getFunctionBody('use_my_coupon_with_admin_password');

  assert.match(functionBody, /p_admin_password text/);
  assert.match(functionBody, /extensions\.crypt\(p_admin_password,\s*v_hashed_password\)/);
  assert.match(functionBody, /public\.resolve_customer_session\(p_session_token\)/);
  assert.match(functionBody, /UPDATE public\.coupon_history/);
  assert.match(functionBody, /customer_id = v_customer_id/);
  assert.match(functionBody, /SET search_path = public, extensions/);
  assert.ok(
    functionBody.indexOf('public.resolve_customer_session(p_session_token)') <
      functionBody.indexOf('extensions.crypt(p_admin_password, v_hashed_password)'),
    'customer session should be resolved before admin password verification',
  );
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

test('session schema: resolve_customer_session is defined and login issues session tokens', () => {
  const resolveFunction = getFunctionBody('resolve_customer_session');
  const loginFunction = getFunctionBody('login_customer');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  assert.match(schema, /CREATE TABLE IF NOT EXISTS public\.customer_sessions/);
  assert.match(schema, /token_hash text PRIMARY KEY/);
  assert.doesNotMatch(schema, /customer_sessions \(\s*token text PRIMARY KEY/);
  assert.match(resolveFunction, /RETURNS uuid/);
  assert.match(resolveFunction, /FROM public\.customer_sessions/);
  assert.match(resolveFunction, /token_hash = encode\(extensions\.digest\(p_session_token, 'sha256'\), 'hex'\)/);
  assert.doesNotMatch(resolveFunction, /s\.token = p_session_token/);
  assert.match(resolveFunction, /revoked_at IS NULL/);
  assert.match(resolveFunction, /expires_at > now\(\)/);
  assert.match(loginFunction, /INSERT INTO public\.customer_sessions \(token_hash, customer_id\)/);
  assert.match(loginFunction, /extensions\.digest\(v_session_token, 'sha256'\)/);
  assert.match(loginFunction, /'session_token', v_session_token/);
});

test('password schema: customer password change clears forced-change flag', () => {
  const functionBody = getFunctionBody('update_customer_password');

  assert.match(functionBody, /SET password = extensions\.crypt\(new_password, extensions\.gen_salt\('bf'\)\),\s+must_change_password = false/);
});

test('coupon schema: direct coupon mutations are denied to client roles', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');

  assert.doesNotMatch(schema, /CREATE POLICY "Allow All (Insert|Update|Delete)" ON coupon_history/);
  assert.doesNotMatch(schema, /CREATE POLICY "Coupon history owner (insert|update|delete)" ON coupon_history/i);
  assert.match(schema, /CREATE POLICY "No Direct Mutation coupon_history" ON coupon_history/);
  assert.match(schema, /FOR ALL TO anon, authenticated USING \(false\) WITH CHECK \(false\)/);
});
