import prettier from 'eslint-plugin-prettier/recommended';
import js from '@eslint/js';
import globals from 'globals';

const jsConfig = {
  languageOptions: {
    globals: {
      ...globals.browser,
    },
  },
};

export default [
  jsConfig,
  prettier,
  {
    ignores: ['.wrangler/'],
  },
];
