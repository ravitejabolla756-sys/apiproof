import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**', '**/.next-*/**', 'next-build-*/**', 'apps/web/next-env.d.ts', 'test-fixtures/**', 'evaluation/corpus/**', 'evaluation-patches/corpus/**', '.tmp/**', 'coverage/**', 'CLONED/**', 'design-references/**', 'my-owl-*/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
    },
  },
);
