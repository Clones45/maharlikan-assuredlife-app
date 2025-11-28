module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Keep other plugins you use, but REMOVE 'expo-router/babel'
    plugins: [
      // e.g. if you use Reanimated, it MUST stay last:
      'react-native-reanimated/plugin',
    ],
  };
};
