import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { verifySsvCallback, type VerifierKey } from './verify.ts';

// Supabase Edge Function: admob-ssv
// AdMob 보상형 광고 서버 측 검증 콜백. AdMob 콘솔의 보상형 광고 단위 설정에서
// "서버 측 확인" 콜백 URL 을 https://<project>.supabase.co/functions/v1/admob-ssv 로 둔다.
// Deploy: supabase functions deploy admob-ssv (config.toml 에서 verify_jwt = false)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
// 쉼표로 구분한 숫자 광고 단위 ID(ca-app-pub-xxx/<이 부분>). 비어 있으면 검사하지 않는다.
// 다른 AdMob 앱의 광고 단위가 우리 콜백 URL 로 보낸 서명된 요청을 걸러낸다.
const ALLOWED_AD_UNITS = (Deno.env.get('ADMOB_REWARDED_AD_UNITS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const VERIFIER_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const KEY_CACHE_MS = 60 * 60 * 1000;

let cachedKeys: { keys: VerifierKey[]; fetchedAt: number } | null = null;

async function getVerifierKeys(forceRefresh = false): Promise<VerifierKey[]> {
  if (!forceRefresh && cachedKeys && Date.now() - cachedKeys.fetchedAt < KEY_CACHE_MS) {
    return cachedKeys.keys;
  }
  const response = await fetch(VERIFIER_KEYS_URL);
  if (!response.ok) throw new Error(`verifier keys fetch failed: ${response.status}`);
  const payload = await response.json();
  const keys = Array.isArray(payload?.keys) ? payload.keys : [];
  cachedKeys = { keys, fetchedAt: Date.now() };
  return keys;
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  try {
    const rawQuery = new URL(req.url).search.replace(/^\?/, '');
    if (rawQuery.length > 4096) return new Response('Bad request', { status: 400 });

    let params = await verifySsvCallback(rawQuery, await getVerifierKeys());
    if (!params) {
      // Google 이 키를 돌렸을 수 있다. 목록을 새로 받아 한 번만 더 본다.
      params = await verifySsvCallback(rawQuery, await getVerifierKeys(true));
    }
    if (!params) return new Response('Invalid signature', { status: 403 });

    if (ALLOWED_AD_UNITS.length > 0 && !ALLOWED_AD_UNITS.includes(params.adUnit)) {
      return new Response('Unknown ad unit', { status: 403 });
    }

    // AdMob 콘솔의 "콜백 확인" 요청은 custom_data 가 없다. 서명만 맞으면 200 으로 답한다.
    if (!/^[0-9a-f]{32}$/.test(params.customData) || !params.transactionId) {
      return new Response('OK', { status: 200 });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await adminClient.rpc('record_ad_reward', {
      p_nonce: params.customData,
      p_transaction_id: params.transactionId.slice(0, 128),
    });
    if (error) throw error;

    // 이미 반영됐거나 만료된 nonce 도 200 이다. 아니면 Google 이 계속 재시도한다.
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('admob-ssv failed:', error);
    return new Response('Server error', { status: 500 });
  }
});
