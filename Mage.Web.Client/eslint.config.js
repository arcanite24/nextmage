import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.tmp', 'test-results', 'playwright-report']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Legacy debt owned by the protocol/state/UI rewrite (roadmap phases 2-4).
      // Warnings are capped by `npm run lint` (--max-warnings), so the count can only go down.
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Standalone entry point, never hot-reloaded as a module.
    files: ['src/visualHarness.tsx', 'src/app/main.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
