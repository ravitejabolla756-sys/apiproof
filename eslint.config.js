import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**', '**/.next-*/**', 'next-build-*/**', 'apps/web/next-env.d.ts', 'test-fixtures/**', 'evaluation/corpus/**', 'evaluation-patches/corpus/**', '.tmp/**', 'coverage/**', 'CLONED/**', 'design-references/**', 'my-owl-*/**'] },
  {
    plugins: nextPlugin.flatConfig.recommended.plugins,
    settings: { next: { rootDir: ['apps/web/', '.'] } },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ...nextPlugin.flatConfig.recommended,
    files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
    },
  },
);
