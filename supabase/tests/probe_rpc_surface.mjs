#!/usr/bin/env node
/**
 * anon 키만으로 배포된 DB 표면을 점검한다.
 *
 * db_integrity_audit.sql 은 pg_proc/pg_constraint 카탈로그를 읽어야 해서
 * service_role 키나 DB 비밀번호가 필요하다. 그게 없을 때 이 스크립트로
 * "어떤 함수/테이블이 존재하고 anon 에 노출돼 있는가"를 대신 확인한다.
 *
 * 상태를 변경하는 호출은 하지 않는다.
 *  - uuid 인자에 잘못된 문자열을 주면 함수 본문 실행 전에 22P02 로 실패하므로
 *    존재 여부만 안전하게 알아낼 수 있다.
 *  - 세션 토큰 인자에는 무효 토큰을 주어 첫 분기에서 즉시 반환시킨다.
 *
 * 사용: node supabase/tests/probe_rpc_surface.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env 를 찾을 수 없습니다. 프로젝트 루트에서 실행하세요.');
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('.env 에 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다.');
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const ref = url.replace(/^https?:\/\//, '').split('.')[0];
console.log(`대상 프로젝트: ${ref}  (EXPO_PUBLIC_ENV=${env.EXPO_PUBLIC_ENV ?? '미설정'})\n`);

async function call(pathname, init) {
  const res = await fetch(`${url}/rest/v1/${pathname}`, { headers, ...init });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, code: body && body.code ? body.code : '', body };
}

// ── A. 테이블 존재 여부 ────────────────────────────────────────────────
console.log('=== A. 테이블 ===');
console.log('PGRST205=없음 / 42501=존재하나 anon 차단(정상) / 200=anon 읽기 허용\n');

const tables = [
  ['app_configs', '매니저 소유. 없으면 redeem_coupon 은 app_configs 버전일 수 없다'],
  ['notices', 'anon 읽기 허용이 정상'],
  ['customers', 'anon 차단이 정상'],
  ['visit_history', 'anon 차단이 정상'],
  ['ai_guest_sessions', 'anon 차단이 정상'],
];
for (const [table, note] of tables) {
  const { status, code, body } = await call(`${table}?select=*&limit=1`);
  const verdict =
    code === 'PGRST205' ? '없음'
    : code === '42501' ? '존재 / anon 차단'
    : status === 200 ? `존재 / anon 읽기 허용 (행 ${Array.isArray(body) ? body.length : '?'})`
    : `기타 ${code}`;
  console.log(`  ${table.padEnd(20)} ${String(status).padEnd(4)} ${code.padEnd(9)} ${verdict}`);
  console.log(`  ${''.padEnd(20)} └ ${note}`);
}

// ── B. 세션 토큰 기반 RPC ──────────────────────────────────────────────
console.log('\n=== B. 세션 토큰 RPC (무효 토큰으로 존재 확인) ===\n');

const INVALID = '__probe_invalid_session_token__';
const sessionProbes = [
  ['redeem_coupon', { p_coupon_id: -1, p_admin_password: '__probe__', p_session_token: INVALID },
    'invalid_session 이면 세션 검증이 최우선으로 동작'],
  ['delete_my_account', { p_session_token: INVALID, input_password: '__probe__' },
    'false 면 세션 토큰판이 배포되어 있고 정상 거부'],
  ['verify_my_password', { p_session_token: INVALID, input_password: '__probe__' },
    'false 면 정상'],
];
for (const [fn, body, note] of sessionProbes) {
  const res = await call(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) });
  const verdict = res.code === 'PGRST202' ? '해당 시그니처 없음' : JSON.stringify(res.body);
  console.log(`  ${fn.padEnd(22)} ${String(res.status).padEnd(4)} ${verdict}`);
  console.log(`  ${''.padEnd(22)} └ ${note}`);
}

// ── C. uuid 기반 RPC (IDOR 노출) ───────────────────────────────────────
console.log('\n=== C. uuid 기반 RPC — anon 노출 여부 ===');
console.log('22P02=존재 + anon 호출 가능(IDOR) / PGRST202=없거나 anon 미노출(원하는 상태)\n');

const uuidProbes = [
  ['delete_my_account(uuid)', 'delete_my_account', { p_id: 'not-a-uuid' }],
  ['update_my_nickname(uuid,text)', 'update_my_nickname', { p_id: 'not-a-uuid', p_new_nickname: 'probe' }],
  ['soft_delete_customer(uuid)', 'soft_delete_customer', { customer_uuid: 'not-a-uuid' }],
  ['verify_password(uuid,text)', 'verify_password', { customer_uuid: 'not-a-uuid', input_password: 'probe' }],
  ['update_customer_password(uuid,text,text)', 'update_customer_password',
    { customer_uuid: 'not-a-uuid', new_password: 'probe123', p_reason: 'probe' }],
];
let exposed = 0;
for (const [label, fn, body] of uuidProbes) {
  const res = await call(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) });
  const isExposed = res.code === '22P02';
  if (isExposed) exposed += 1;
  const verdict = isExposed
    ? '⚠ 존재 + anon 호출 가능'
    : res.code === 'PGRST202' ? '없거나 anon 미노출'
    : `기타 ${res.code}`;
  console.log(`  ${label.padEnd(42)} ${res.code.padEnd(9)} ${verdict}`);
}

console.log(`\nanon 에 노출된 uuid RPC: ${exposed}/${uuidProbes.length}`);
if (exposed > 0) {
  console.log('→ docs/manager-app-db-issues.md §2 의 REVOKE 문 참고');
}
