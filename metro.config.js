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

module.exports = config;
