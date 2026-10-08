const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

let hasError = false;

// EXPO_PUBLIC_* 값은 앱 번들에 그대로 들어간다. 공개해도 되는 것만 허용한다.
const ALLOWED_PUBLIC_ENV = new Set([
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_ENV',
  'EXPO_PUBLIC_API_TIMEOUT',
  'EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID',
  'EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID',
]);

walkDir(srcDir, (filePath) => {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');

  // 1) Client code may only read allow-listed public env vars
  if (filePath.endsWith('.js')) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const [name] of content.matchAll(/EXPO_PUBLIC_[A-Z0-9_]+/g)) {
      if (!ALLOWED_PUBLIC_ENV.has(name)) {
        console.error(`🚨 Non-allow-listed public env var ${name} referenced in ${relPath}`);
        hasError = true;
      }
    }
  }

  // 2) Ensure deprecated hook files do not return
  if (relPath === 'src/hooks/useOpenAI.js' || relPath === 'src/services/openaiService.js') {
    console.error(`🚨 Deprecated OpenAI file detected: ${relPath}`);
    hasError = true;
  }
});

// 3) No secrets in tracked files. 공개 저장소라 한 번 올라가면 이력에서 지울 수 없다.
const SECRET_PATTERNS = [
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Google service account', /"type"\s*:\s*"service_account"/],
];

const decodeJwtRole = (jwt) => {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
    return payload.role || '';
  } catch {
    return '';
  }
};

const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|ttf|otf|woff2?|mp3|mp4|zip|jar|keystore)$/i;
const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: rootDir, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

for (const relPath of trackedFiles) {
  const base = path.basename(relPath);
  if (/^\.env/.test(base) && base !== '.env.example') {
    console.error(`🚨 Environment file is tracked by git: ${relPath}`);
    hasError = true;
    continue;
  }
  if (BINARY_EXT.test(relPath)) continue;

  const filePath = path.join(rootDir, relPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size > 2 * 1024 * 1024) continue;
  const content = fs.readFileSync(filePath, 'utf8');

  // 값은 출력하지 않는다. CI 로그도 공개다.
  for (const [label, pattern] of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`🚨 Possible ${label} committed in ${relPath}`);
      hasError = true;
    }
  }
  for (const [jwt] of content.matchAll(/eyJ[0-9A-Za-z_-]+\.eyJ[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+/g)) {
    if (decodeJwtRole(jwt) === 'service_role') {
      console.error(`🚨 Supabase service_role key committed in ${relPath}`);
      hasError = true;
    }
  }
}

if (hasError) {
  process.exit(1);
} else {
  console.log('✅ security-check passed');
}
