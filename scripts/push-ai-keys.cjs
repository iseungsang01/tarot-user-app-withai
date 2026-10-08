// .env 의 GOOGLE_API_KEY_1, _2, … 를 모아 Supabase 시크릿 GOOGLE_API_KEYS(쉼표 구분)로 올린다.
// 키 값은 화면에 찍지 않는다. 임시 env 파일은 OS 임시 폴더에 쓰고 바로 지운다.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const envPath = path.join(__dirname, '..', '.env');
const env = fs.readFileSync(envPath, 'utf8').replace(/^﻿/, '');
const keys = [...env.matchAll(/^GOOGLE_API_KEY_(\d+)\s*=\s*"?([^"\r\n#]*)"?/gm)]
  .sort((a, b) => Number(a[1]) - Number(b[1]))
  .map((match) => match[2].trim())
  .filter(Boolean);

if (keys.length === 0) {
  console.error('❌ .env 에 GOOGLE_API_KEY_1= … 값이 없습니다.');
  process.exit(1);
}
// 옛 형식 AIza… 와 AI Studio 의 새 형식 AQ.… 둘 다 받는다.
const malformed = keys.filter((key) => !/^(AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z._-]{40,})$/.test(key));
if (malformed.length > 0) {
  console.error(`❌ Google API 키 형식이 아닌 값이 ${malformed.length}개 있습니다.`);
  process.exit(1);
}
if (new Set(keys).size !== keys.length) {
  console.error('❌ 같은 키가 두 번 들어 있습니다.');
  process.exit(1);
}

const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ai-keys-')), 'secrets.env');
try {
  fs.writeFileSync(tmp, `GOOGLE_API_KEYS=${keys.join(',')}\n`, { mode: 0o600 });
  execFileSync('npx', ['-y', 'supabase@latest', 'secrets', 'set', '--env-file', tmp], { stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' });
} finally {
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
}
console.log(`✅ GOOGLE_API_KEYS 에 키 ${keys.length}개를 올렸습니다: ${keys.map((key) => `…${key.slice(-4)}`).join(', ')}`);
console.log('   ai-proxy 를 다시 배포하세요: npx supabase functions deploy ai-proxy');
