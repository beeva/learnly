module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated's plugin rewrites worklets and must stay last.
    plugins: ["react-native-reanimated/plugin"],
  };
};
