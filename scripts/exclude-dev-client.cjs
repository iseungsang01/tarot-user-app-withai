// EAS production 빌드에서만 expo-dev-client 일가를 autolinking 에서 뺀다.
// dev launcher 가 Compose · ML Kit 바코드 스캐너까지 릴리스 번들에 끌고 들어와 다운로드 크기를 키운다.
const fs = require('fs');
const path = require('path');

if (process.env.EAS_BUILD_PROFILE !== 'production') process.exit(0);

const file = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.expo = pkg.expo || {};
pkg.expo.autolinking = pkg.expo.autolinking || {};
pkg.expo.autolinking.exclude = ['expo-dev-client', 'expo-dev-launcher', 'expo-dev-menu', 'expo-dev-menu-interface'];
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log('production 빌드: expo-dev-client 를 autolinking 에서 제외');
