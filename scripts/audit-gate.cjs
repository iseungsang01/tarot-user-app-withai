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
  'GHSA-mh99-v99m-4gvg': {
    package: 'brace-expansion',
    why:
      '취약 범위가 <=5.0.7 이라 1.x/2.x 라인 전체가 해당되고 그 라인에는 패치판이 없다. ' +
      '유일한 안전 버전 5.0.8 은 CJS 진입점이 함수가 아니라 { expand } 객체라 ' +
      'require("brace-expansion")(pattern) 으로 호출하는 minimatch 3.x/glob 을 깨뜨린다. ' +
      'npm 이 제시하는 fixAvailable 은 react-native 0.86.2 major 업그레이드다.',
    risk:
      '빌드 타임 도구 체인(glob/minimatch/jest/codegen)에서만 쓰이고 앱 번들에 포함되지 않는다. ' +
      '공격자가 제어하는 glob 패턴을 처리하는 경로가 없어 DoS 트리거 조건이 성립하지 않는다.',
    reviewBy: '2026-10-31',
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
