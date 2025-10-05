const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// enable support for ESM files used by libsignal
config.resolver.sourceExts.push('mjs', 'cjs');
config.resolver.assetExts.push('wasm');
config.transformer = {
  ...config.transformer,
  experimentalImportSupport: true,
};

module.exports = config;