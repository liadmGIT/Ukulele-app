module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo automatically adds the react-native-worklets plugin when
  // reanimated is installed, so it must not be listed again here.
  return {
    presets: ['babel-preset-expo'],
  };
};
