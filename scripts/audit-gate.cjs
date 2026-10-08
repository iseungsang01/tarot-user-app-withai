#!/usr/bin/env node
/**
 * npm audit 게이트.
 *
 * `npm audit --audit-level=high` 를 그대로 쓰면 업스트림에 패치가 없는 권고 하나 때문에
 * CI 가 영구히 빨간불이 되고, 결국 아무도 안 보게 된다. 이 스크립트는 high/critical 을
 * 여전히 차단하되 아래 ALLOWLIST 에 명시적으로 적어둔 권고만 통과시킨다.
 *
 * 규칙:
 *  - 목록에 없는 high/critical 이 새로 생기면 실패한다 (게이트의 본래 목적)
 *  - 허용 항목도 reviewBy 가 지나면 실패한다 (방치 방지)
 *  - 허용 항목이 더 이상 audit 에 안 나오면 경고한다 (죽은 항목 정리 유도)
 */
const { execSync } = require('node:child_process');

/**
 * 여기 추가할 때는 반드시 다음을 채운다.
 *  - why: 왜 지금 고칠 수 없는가 (업스트림 상태)
 *  - risk: 왜 이 프로젝트에서 실제 위험이 낮은가
 *  - reviewBy: 이 날짜가 지나면 CI 가 다시 실패한다. 재확인 강제용.
 */
const ALLOWLIST = {
  // 비어 있는 것이 정상 상태다. high/critical 은 원칙적으로 고쳐서 없앤다.
  //
  // 2026-08-07: brace-expansion(GHSA-mh99-v99m-4gvg) 이 여기 있었으나 제거했다.
  // "1.x/2.x 라인에 패치판이 없다"는 당시 근거가 무효가 됐다 — 1.1.18 / 2.1.4 /
  // 5.0.9 가 나와서 major 업그레이드 없이 `npm audit fix` 로 해결된다.
  // 허용 항목을 넣기 전에 반드시 패치판이 정말 없는지 다시 확인할 것.

  // image-size 두 건은 같은 처지라 근거가 같다. 의존 경로도 하나뿐이다:
  //   expo@54 → @expo/metro@54 → metro@0.83.3 → image-size@1.2.1
  // 2026-10-08 재검토: 2.0.3 에서 패치됐지만 1.x 라인(최신 1.2.1)에는 패치판이 없다.
  // overrides 로 2.x 를 강제하는 것은 검토 후 기각했다 — metro 0.83.x(최신 0.83.8 도
  // image-size ^1.0.2)의 src/Assets.js 가 `imageSize(filePath)` 처럼 파일 경로 문자열을 넘기는데,
  // 2.x 의 기본 export 는 Uint8Array 만 받는다(경로는 별도 비동기 imageSizeFromFile). 강제하면
  // 이미지 에셋 해석이 빌드 중에 깨진다.
  'GHSA-w3rx-r6r6-pgpr': {
    package: 'image-size',
    why: '패치판(2.0.3)은 semver major 이고 API 가 바뀌었다(경로 입력 제거). metro 0.83.x 가 ^1.0.2 를 '
      + '고정하고 경로 문자열로 호출하므로 override 로 올릴 수 없다. 1.x 라인에는 패치판이 없다. '
      + 'npm audit 이 제안하는 "수정"은 react-native 0.72.17 로의 다운그레이드(semver major)라 채택할 수 없다.',
    risk: 'image-size 는 Metro 번들러의 빌드타임 의존성이라 앱 번들에 들어가지 않는다. '
      + '빌드 중 읽는 것은 저장소 안의 우리 이미지(WebP/PNG/SVG)뿐이고, 외부에서 들어온 이미지가 '
      + '이 파서에 닿는 경로가 없다. 사용자가 첨부하는 사진은 런타임에 expo-image-manipulator 가 '
      + '처리하며 image-size 와 무관하다. 문제의 ICNS·JXL·HEIF 는 이 프로젝트가 쓰지도 않는 포맷이다.',
    reviewBy: '2026-11-08',
  },
  'GHSA-5p2g-fcmc-qvqq': {
    package: 'image-size',
    why: 'GHSA-w3rx-r6r6-pgpr 와 동일 (같은 패키지·같은 미해결 상태).',
    risk: 'GHSA-w3rx-r6r6-pgpr 와 동일 (빌드타임 전용, 외부 입력이 닿지 않음).',
    reviewBy: '2026-11-08',
  },

  // 2026-10-08 추가. 경로: expo@54 → @expo/metro → metro-file-map@0.83.3 → micromatch@4.0.8 → braces@3.0.3
  // (그 밖에 react-native → jest 계열 → micromatch 도 같은 braces 를 쓴다)
  'GHSA-vfj7-8cjw-p6xm': {
    package: 'braces',
    why: '패치판이 없다. 취약 범위가 <=3.0.3 이고 3.0.3 이 레지스트리 최신이다 (first_patched_version 없음).',
    risk: 'braces 는 Metro 파일맵·jest 의 glob 매칭에만 쓰이는 빌드/개발 도구 의존성이라 앱 번들에 들어가지 않는다. '
      + '패턴은 Metro/jest 설정과 저장소 경로에서만 오고, 외부 입력이 glob 패턴으로 들어가는 경로가 없다. '
      + '영향도 빌드 프로세스의 스택 고갈(DoS)뿐이다.',
    reviewBy: '2026-11-08',
  },
  // 2026-10-08 추가. 경로: expo@54 → @expo/cli@54.0.27 → node-forge@1.4.0
  // (@expo/cli → @expo/code-signing-certificates → node-forge 도 같은 판)
  'GHSA-86w9-cpqp-85rv': {
    package: 'node-forge',
    why: '패치판이 없다. 취약 범위가 <=1.4.0 이고 1.4.0 이 레지스트리 최신이다 (first_patched_version 없음). '
      + '@expo/cli 54 최신판도 node-forge ^1.3.3 을 그대로 쓴다.',
    risk: 'node-forge 는 개발 머신에서 도는 @expo/cli(개발 서버 HTTPS·EAS Update 코드 서명 인증서 생성)에서만 쓰이고 '
      + '앱 번들에 들어가지 않는다. 문제는 RSA PKCS#1 v1.5 서명 "검증"의 느슨함인데, 이 프로젝트는 '
      + 'expo-updates 코드 서명을 쓰지 않으며 앱 런타임 어디서도 node-forge 로 서명을 검증하지 않는다.',
    reviewBy: '2026-11-08',
  },
};

function runAudit() {
  try {
    return execSync('npm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (error) {
    // 취약점이 있으면 npm audit 은 non-zero 로 끝나지만 stdout 에 정상 JSON 을 남긴다.
    if (error.stdout) return error.stdout;
    throw error;
  }
}

const audit = JSON.parse(runAudit());
const BLOCKING = new Set(['high', 'critical']);

// 권고(advisory) 단위로 모은다. npm 은 같은 권고를 의존 체인마다 반복해서 싣는다.
const advisories = new Map();
for (const vuln of Object.values(audit.vulnerabilities || {})) {
  for (const via of vuln.via || []) {
    if (typeof via !== 'object' || !BLOCKING.has(via.severity)) continue;
    const id = (via.url || '').split('/').pop();
    if (!id) continue;
    if (!advisories.has(id)) {
      advisories.set(id, { id, name: via.name, severity: via.severity, title: via.title, url: via.url });
    }
  }
}

const today = new Date().toISOString().slice(0, 10);
const blocked = [];
const allowed = [];

for (const advisory of advisories.values()) {
  const entry = ALLOWLIST[advisory.id];
  if (!entry) {
    blocked.push({ advisory, reason: '허용 목록에 없음' });
  } else if (entry.reviewBy < today) {
    blocked.push({ advisory, reason: `허용 기한 만료 (reviewBy ${entry.reviewBy})` });
  } else {
    allowed.push({ advisory, entry });
  }
}

for (const { advisory, entry } of allowed) {
  console.log(`허용됨  ${advisory.severity.toUpperCase()} ${advisory.id} (${advisory.name}) — 재검토 기한 ${entry.reviewBy}`);
}

// 이미 해결됐는데 목록에 남아 있는 항목은 지워야 한다.
for (const [id, entry] of Object.entries(ALLOWLIST)) {
  if (!advisories.has(id)) {
    console.warn(`정리 필요  ${id} (${entry.package}) 는 더 이상 audit 에 나오지 않는다. ALLOWLIST 에서 제거할 것.`);
  }
}

if (blocked.length > 0) {
  console.error('');
  for (const { advisory, reason } of blocked) {
    console.error(`차단  ${advisory.severity.toUpperCase()} ${advisory.id} (${advisory.name}) — ${reason}`);
    console.error(`      ${advisory.title}`);
    console.error(`      ${advisory.url}`);
  }
  console.error('');
  console.error('고칠 수 있으면 고치고, 정말 불가피하면 scripts/audit-gate.cjs 의 ALLOWLIST 에');
  console.error('why/risk/reviewBy 를 채워서 추가할 것. 근거 없이 추가하지 말 것.');
  process.exit(1);
}

const counts = audit.metadata?.vulnerabilities || {};
console.log(`\n통과: 차단 대상 high/critical 없음 (전체 moderate ${counts.moderate ?? 0} / high ${counts.high ?? 0})`);
