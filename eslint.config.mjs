import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { ruleCodeBlock } from './tools/lint/rule-code-block.mjs';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'tools/lint-fixtures/bad-rule.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: { process: 'readonly' } },
  },
  ruleCodeBlock(),
);
