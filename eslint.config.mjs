import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts', 'drizzle/**'],
  },

  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    /**
     * The scoring / value-gap engine must stay free of React, Next, and the
     * database so it can be unit tested in isolation and reused by the PDF
     * route, the dashboard, and the release snapshot.
     */
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/components/*', '@/app/*', '@/db/*', '@/pdf/*', 'react', 'react-dom', 'next/*'],
              message:
                'The engine is pure: no React, Next, or database imports. Pass data in, get numbers out.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx', 'scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];

export default config;
