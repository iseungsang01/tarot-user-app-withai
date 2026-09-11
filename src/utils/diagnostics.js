import { Platform } from 'react-native';
import { coreStorage, STORAGE_KEYS } from './storage/core';
import { APP_INFO } from '../constants/Config';

/**
 * 진단 로그.
 *
 * 출시된 앱에서는 에러가 아무 데도 남지 않았다 — logError 가 프로덕션에서 그냥
 * return 했다. 매장에서 쿠폰 사용이 실패해도 나중에 확인할 근거가 0이었다.
 *
 * 그래서 기기 안에 최근 에러를 링버퍼로 쌓아 두고, 회원이 버그를 접수할 때
 * bug_reports.device_info 에 같이 실어 보낸다. 그 컬럼과 submit_bug_report 의
 * p_device_info 는 원래부터 있었는데 클라이언트가 계속 null 을 보내고 있었다.
 * 개인정보 처리방침 제1조 2항의 "문의를 접수한 경우 ... 기기 정보"가 이것이다.
 *
 * 상시 서버 전송은 하지 않는다. 그건 유저앱 전용 테이블 신설 + 매니저의 운영
 * 적용 + 처리방침 개정이 따라붙어서, 접수 시 첨부로 먼저 간다.
 */

// 기기에 쌓아 두는 최대 건수. 200건이면 한 세션에서 연쇄로 터져도 원인 근처가 남는다
const MAX_ENTRIES = 200;
// 접수에 실어 보내는 건수. device_info 가 jsonb 라 통째로 보내면 행이 비대해진다
const ATTACHED_ENTRIES = 50;
const MAX_MESSAGE_LENGTH = 200;
const MAX_EXTRA_LENGTH = 400;
// 에러는 보통 연쇄로 터진다. 건마다 쓰지 않고 한 번에 모아 쓴다
const SAVE_DEBOUNCE_MS = 800;

// 이 키에 걸리는 값은 값 자체를 버린다. 관리자 비밀번호·세션 토큰이 로그로
// 새면 로그가 있는 게 없는 것보다 나쁘다
const SECRET_KEY_PATTERN = /(password|token|secret|api[-_]?key|authorization|credential)/i;
const PHONE_PATTERN = /01\d[-\s]?\d{3,4}[-\s]?\d{4}/g;
// 세션 토큰처럼 긴 무의미 문자열이 메시지 본문에 섞여 나오는 경우
const OPAQUE_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{32,}\b/g;
const REDACTED = '[redacted]';

const scrubText = (value) => {
  if (typeof value !== 'string') return value;
  return value.replace(PHONE_PATTERN, REDACTED).replace(OPAQUE_TOKEN_PATTERN, REDACTED);
};

const scrubExtra = (extra) => {
  if (!extra || typeof extra !== 'object') return null;

  const safe = {};
  for (const [key, value] of Object.entries(extra)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      safe[key] = REDACTED;
      continue;
    }
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') safe[key] = scrubText(value);
    else if (typeof value === 'number' || typeof value === 'boolean') safe[key] = value;
    else safe[key] = scrubText(String(value));
  }

  if (Object.keys(safe).length === 0) return null;

  const serialized = JSON.stringify(safe);
  if (serialized.length <= MAX_EXTRA_LENGTH) return safe;
  return { truncated: serialized.slice(0, MAX_EXTRA_LENGTH) };
};

export const buildEntry = (context, error, extra, now = new Date()) => {
  const message = scrubText(error?.message || '알 수 없는 오류');
  const entry = {
    t: now.toISOString(),
    ctx: String(context || 'unknown').slice(0, 60),
    msg: message.slice(0, MAX_MESSAGE_LENGTH),
  };

  if (error?.code) entry.code = String(error.code).slice(0, 60);
  if (error?.status) entry.status = error.status;

  const safeExtra = scrubExtra(extra);
  if (safeExtra) entry.extra = safeExtra;

  return entry;
};

let buffer = null;
let loadPromise = null;
let saveTimer = null;

const ensureLoaded = async () => {
  if (buffer) return buffer;
  if (!loadPromise) {
    loadPromise = (async () => {
      const stored = await coreStorage.get(STORAGE_KEYS.DIAGNOSTIC_LOG);
      buffer = Array.isArray(stored) ? stored.slice(-MAX_ENTRIES) : [];
      return buffer;
    })();
  }
  return loadPromise;
};

const flush = async () => {
  saveTimer = null;
  if (!buffer) return;
  await coreStorage.save(STORAGE_KEYS.DIAGNOSTIC_LOG, buffer);
};

const scheduleSave = () => {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { flush(); }, SAVE_DEBOUNCE_MS);
  // 저장 하나 때문에 테스트 러너나 백그라운드 전환이 붙잡히지 않게 한다
  if (typeof saveTimer?.unref === 'function') saveTimer.unref();
};

/**
 * 에러 한 건을 기기 로그에 기록한다.
 *
 * logError 가 동기 함수라 기다리지 않고 띄워 보낸다. 로그를 남기려다 실패하는
 * 것이 원래 에러를 덮으면 안 되므로 어떤 경우에도 throw 하지 않는다.
 */
export const recordDiagnostic = (context, error, extra = {}) => {
  ensureLoaded()
    .then((entries) => {
      entries.push(buildEntry(context, error, extra));
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
      scheduleSave();
    })
    .catch(() => {});
};

/** 최신순으로 읽는다. 화면에 그대로 뿌리는 순서다 */
export const readDiagnostics = async () => {
  const entries = await ensureLoaded();
  return [...entries].reverse();
};

export const clearDiagnostics = async () => {
  buffer = [];
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await coreStorage.save(STORAGE_KEYS.DIAGNOSTIC_LOG, []);
};

/**
 * 기기 요약. 네이티브 모듈 없이 Platform.constants 에서 얻을 수 있는 것만 쓴다.
 * Android 의 Serial·Fingerprint 는 기기 식별값이라 의도적으로 뺐다.
 */
export const describeDevice = () => {
  const constants = Platform.constants || {};

  if (Platform.OS === 'android') {
    return {
      platform: 'android',
      os: constants.Release ? `Android ${constants.Release}` : `Android API ${Platform.Version}`,
      device: [constants.Brand, constants.Model].filter(Boolean).join(' ') || null,
    };
  }

  return {
    platform: Platform.OS,
    os: [constants.systemName, constants.osVersion].filter(Boolean).join(' ') || String(Platform.Version ?? ''),
    device: constants.interfaceIdiom || null,
  };
};

/** 버그 접수에 실어 보낼 device_info. submit_bug_report 의 p_device_info 로 그대로 들어간다 */
export const buildDeviceInfo = async () => {
  const entries = await ensureLoaded().catch(() => []);
  return {
    app: APP_INFO.version,
    ...describeDevice(),
    collectedAt: new Date().toISOString(),
    logs: entries.slice(-ATTACHED_ENTRIES).reverse(),
  };
};

/** 테스트 전용 — 모듈 수준 버퍼를 비운다 */
export const __resetDiagnostics = () => {
  buffer = null;
  loadPromise = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
};
