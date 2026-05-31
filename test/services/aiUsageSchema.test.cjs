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

test('ai usage schema: increment function avoids ambiguous month_bucket conflict target', () => {
  const functionBody = getFunctionBody('increment_my_ai_monthly_usage');

  assert.match(functionBody, /ON CONFLICT ON CONSTRAINT ai_monthly_usage_pkey/);
  assert.doesNotMatch(
    functionBody,
    /ON CONFLICT\s*\(\s*customer_id\s*,\s*month_bucket\s*,\s*usage_type\s*\)/,
  );
});

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

test('coupon schema: direct coupon mutations are denied to client roles', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');

  assert.doesNotMatch(schema, /CREATE POLICY "Allow All (Insert|Update|Delete)" ON coupon_history/);
  assert.doesNotMatch(schema, /CREATE POLICY "Coupon history owner (insert|update|delete)" ON coupon_history/i);
  assert.match(schema, /CREATE POLICY "No Direct Mutation coupon_history" ON coupon_history/);
  assert.match(schema, /FOR ALL TO anon, authenticated USING \(false\) WITH CHECK \(false\)/);
});
