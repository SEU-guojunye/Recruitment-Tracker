import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { globalIgnores } from 'eslint/config'

const runtimeGlobals = {
  ...globals.browser,
  ...globals.node,
  chrome: 'readonly',
}

export default [
  globalIgnores([
    '**/dist/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'dashboard.html',
  ]),
  {
    ...js.configs.recommended,
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: 2022,
      globals: runtimeGlobals,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
  },
  {
    files: ['apps/**/*.{js,jsx}', 'packages/ui/**/*.{js,jsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: runtimeGlobals,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      ...reactRefresh.configs.vite.rules,
    },
  },
  {
    files: ['**/*.{test,spec}.{js,jsx}', 'tests/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...runtimeGlobals,
        ...globals.vitest,
      },
    },
  },
]
