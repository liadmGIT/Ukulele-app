const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', 'dist/**', '.expo/**', 'content/chords.json'],
  },
  {
    files: ['src/i18n/**', 'src/analysis/__tests__/**'],
    rules: {
      // i18next's default export genuinely carries `use` and `changeLanguage`;
      // the rule cannot tell that apart from an accidental named import.
      'import/no-named-as-default-member': 'off',
    },
  },
  {
    rules: {
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          alphabetize: { order: 'asc', caseInsensitive: true },
          'newlines-between': 'always',
        },
      ],
    },
  },
];
