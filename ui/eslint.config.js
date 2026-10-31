import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import reactRefresh from 'eslint-plugin-react-refresh';
import unicorn from 'eslint-plugin-unicorn';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  { ignores: ['dist', 'node_modules', 'public', 'tailwind.config.js', 'postcss.config.js'] },
  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-refresh': reactRefresh,
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'warn',
      'import/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling'],
            'index',
            'object',
            'type',
          ],
          pathGroups: [
            { pattern: 'react', group: 'builtin', position: 'before' },
            { pattern: 'react-dom/**', group: 'builtin', position: 'after' },
            { pattern: 'react-router-dom', group: 'builtin', position: 'after' },
            { pattern: '@/features/guest/**', group: 'internal', position: 'before' },
            { pattern: '@/features/dashboard/**', group: 'internal', position: 'before' },
            { pattern: '@/features/**', group: 'internal', position: 'before' },
            { pattern: '@/components/**', group: 'internal' },
            { pattern: '@/hooks/**', group: 'internal' },
            { pattern: '@/lib/**', group: 'internal' },
            { pattern: '@/utils/**', group: 'internal' },
            { pattern: '@/layouts/**', group: 'internal' },
            { pattern: '@/routes/**', group: 'internal' },
          ],
          pathGroupsExcludedImportTypes: ['react'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
  {
    files: ['src/features/**/components/**/*.tsx', 'src/features/**/pages/**/*.tsx'],
    plugins: { unicorn },
    rules: {
      'unicorn/filename-case': [
        'warn',
        {
          case: 'pascalCase',
        },
      ],
    },
  },
  {
    files: ['src/features/**/hooks/**/*.ts', 'src/hooks/**/*.ts'],
    plugins: { unicorn },
    rules: {
      'unicorn/filename-case': ['warn', { case: 'camelCase' }],
    },
  },
  {
    files: [
      'src/features/**/lib/**/*.ts',
      'src/features/**/schemas/**/*.ts',
      'src/features/**/components/**/*.ts',
      'src/lib/**/*.ts',
      'src/utils/**/*.ts',
    ],
    plugins: { unicorn },
    rules: {
      'unicorn/filename-case': [
        'warn',
        {
          case: 'camelCase',
        },
      ],
    },
  },
  {
    files: ['src/**/routes/**/*.tsx', 'src/components/ui/**/*.tsx'],
    rules: {
      'unicorn/filename-case': 'off',
    },
  },
];
