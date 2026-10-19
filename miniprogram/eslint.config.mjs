import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', '.temp/**', '**/*.generated.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{js,mjs,ts,tsx}'], languageOptions: { globals: globals.node } },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    languageOptions: {
      globals: {
        defineAppConfig: 'readonly',
        definePageConfig: 'readonly',
        __API_BASE_URL__: 'readonly',
        __APP_VERSION__: 'readonly',
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'fetch',
        'navigator',
      ],
      'no-restricted-imports': [
        'error',
        { paths: ['react-dom', 'react-router-dom', 'axios'], patterns: ['**/frontend/**'] },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSXOpeningElement[name.name=/^(div|span|button|input|img|form|select|textarea|a)$/]',
          message: '使用 Taro 组件或本端公共组件，不使用 DOM 标签。',
        },
      ],
    },
  },
);
