const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite ships its web implementation as a WebAssembly module, which Metro
// only bundles when .wasm is registered as an asset. Harmless on native.
config.resolver.assetExts.push('wasm');

module.exports = config;
