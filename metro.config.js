const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// OMX writes short-lived lock/log files while the dev server is running.
// Metro's Windows fallback watcher can crash if one of those files disappears
// between directory traversal and fs.watch(), so keep runtime state out of
// Metro's file map entirely.
config.resolver.blockList = [
  /[/\\]\.omx[/\\].*/,
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
];

// AdMob 은 네이티브 전용이라 웹 번들에서 터진다(rewardedAdService 가 런타임에선
// 이미 웹을 막아 두지만, Metro 는 require 를 정적으로 따라간다).
const ADS_MODULE = 'react-native-google-mobile-ads';
const ADS_WEB_STUB = path.resolve(__dirname, 'src/services/adsWebStub.js');
const resolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === ADS_MODULE) {
    return { type: 'sourceFile', filePath: ADS_WEB_STUB };
  }
  return (resolveRequest || context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
