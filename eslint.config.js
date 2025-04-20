// eslint.config.js
import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // Global ignores
  {
    ignores: ['.next/**/*', 'dist/**/*', 'node_modules/**/*']
  },
  
  // Base configuration for JavaScript files
  {
    files: ['.next/**/*.js', '.next/**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        'React': 'readonly'
      }
    },
    rules: {
      'no-undef': ['error', { typeof: false }],
      'no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'ignoreRestSiblings': true 
      }]
    }
  },
  
  // TypeScript files configuration
  {
    files: ['.next/**/*.ts', '.next/**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        'React': 'readonly'
      }
    },
    rules: {
      // TypeScript already handles undefined variables better than ESLint
      'no-undef': 'off',
      'no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'ignoreRestSiblings': true 
      }],
      'react/react-in-jsx-scope': 'off'
    }
  },
  
  // Next.js specific configuration
  ...compat.config({
    extends: ['next/core-web-vitals'],
    settings: {
      next: {
        rootDir: 'apps/dashboard'
      }
    }
  })
];
