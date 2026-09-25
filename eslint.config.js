// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Enforces the TypeScript conventions in CLAUDE.md beyond what `tsc --strict`
 * catches — chiefly "avoid `any`". Run with `npm run lint`; the Pages
 * workflow runs it before deploying.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'public/',
      // Agent skill tooling — not part of the shipped game bundle.
      '.claude/',
      // Vite dev-server cache artifacts (should not be committed).
      'vite.config.ts.timestamp-*.mjs'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // tsc's noUnusedLocals/noUnusedParameters already cover this; the `_`
      // prefix is this codebase's marker for intentionally unused params.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    // Playwright helpers: Node driver + browser globals inside page.evaluate().
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  }
);
