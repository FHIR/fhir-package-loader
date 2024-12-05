import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    ignores: ['dist/*', 'coverage/*', 'build/*', '**/*.d.ts', 'src/public/', 'src/types/']
  },
  ...compat.extends(
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:import/recommended',
    'plugin:import/typescript'
  ),
  {
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2018,
      sourceType: 'module'
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json'
        }
      }
    },
    rules: {
      semi: ['error', 'always'],
      quotes: [
        'error',
        'single',
        {
          avoidEscape: true
        }
      ],
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true
        }
      ],
      'import/order': [
        'error',
        {
          groups: [
            'builtin', // Built-in imports (come from NodeJS native) go first
            'external', // <- External imports
            'internal', // <- Absolute imports
            'sibling', // <- Relative sibling imports (./)
            'parent', // <- Relative parent imports (../)
            'index', // <- index imports
            'unknown' // <- unknown
          ],
          alphabetize: {
            /* sort in ascending order. Options: ["ignore", "asc", "desc"] */
            order: 'asc',
            /* ignore case. Options: [true, false] */
            caseInsensitive: true
          }
        }
      ],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
];
