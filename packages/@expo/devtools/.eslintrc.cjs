module.exports = {
  ...require('expo-module-scripts/eslintrc.base.js'),
  rules: {
    ...require('expo-module-scripts/eslintrc.base.js').rules,
    'import/extensions': ['error', 'ignorePackages'],
  },
};
