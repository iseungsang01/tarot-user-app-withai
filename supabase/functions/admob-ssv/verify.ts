// AdMob 보상형 광고 서버 측 검증(SSV) 콜백의 서명 검증.
// https://developers.google.com/admob/android/ssv
//
// Google 은 광고 시청이 끝나면 콜백 URL 로 GET 을 보낸다. 쿼리 문자열 중
// '&signature=' 앞부분 전체가 서명 대상이고, signature 는 ECDSA P-256 / SHA-256 의
// DER 서명을 base64url 로 인코딩한 것, key_id 는 공개키 목록의 keyId 다.

export type VerifierKey = { keyId: number | string; base64: string };

export type SsvParams = {
  customData: string;
  transactionId: string;
  adUnit: string;
};

const base64ToBytes = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

/** DER(SEQUENCE{INTEGER r, INTEGER s}) → WebCrypto 가 받는 r||s(64바이트). */
export const derToRawSignature = (der: Uint8Array): Uint8Array<ArrayBuffer> | null => {
  let offset = 0;
  if (der[offset++] !== 0x30) return null;
  let seqLength = der[offset++];
  if (seqLength & 0x80) {
    const lengthBytes = seqLength & 0x7f;
    seqLength = 0;
    for (let i = 0; i < lengthBytes; i += 1) seqLength = (seqLength << 8) | der[offset++];
  }
  if (offset + seqLength !== der.length) return null;

  const raw = new Uint8Array(64);
  for (const target of [0, 32]) {
    if (der[offset++] !== 0x02) return null;
    const length = der[offset++];
    if (offset + length > der.length) return null;
    let integer = der.subarray(offset, offset + length);
    offset += length;
    while (integer.length > 32 && integer[0] === 0) integer = integer.subarray(1);
    if (integer.length > 32) return null;
    raw.set(integer, target + 32 - integer.length);
  }
  return offset === der.length ? raw : null;
};

/**
 * 서명이 맞으면 콜백 파라미터를, 아니면 null 을 돌려준다.
 * rawQuery 는 '?' 뒤의 원본 쿼리 문자열(디코딩 전)이어야 한다.
 */
export async function verifySsvCallback(rawQuery: string, keys: VerifierKey[]): Promise<SsvParams | null> {
  const signatureIndex = rawQuery.indexOf('&signature=');
  if (signatureIndex <= 0) return null;

  const signedContent = rawQuery.slice(0, signatureIndex);
  const params = new URLSearchParams(rawQuery);
  const signature = params.get('signature');
  const keyId = params.get('key_id');
  if (!signature || !keyId) return null;

  const key = keys.find((candidate) => String(candidate.keyId) === keyId);
  if (!key) return null;

  const rawSignature = derToRawSignature(base64ToBytes(signature));
  if (!rawSignature) return null;

  const publicKey = await crypto.subtle.importKey(
    'spki',
    base64ToBytes(key.base64),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    rawSignature,
    new TextEncoder().encode(signedContent),
  );
  if (!valid) return null;

  // 서명 대상 안의 값만 믿는다.
  const signed = new URLSearchParams(signedContent);
  return {
    customData: signed.get('custom_data') ?? '',
    transactionId: signed.get('transaction_id') ?? '',
    adUnit: signed.get('ad_unit') ?? '',
  };
}
