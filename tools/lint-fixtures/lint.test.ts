import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { ruleCodeBlock } from '../lint/rule-code-block.mjs';

const root = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

describe('lint rules for rule code', () => {
  it('fails on the fixture and names Math.random and a line', async () => {
    const eslint = new ESLint({
      cwd: root,
      ignore: false,
      overrideConfig: [ruleCodeBlock(['tools/lint-fixtures/bad-rule.ts'])],
    });
    const [result] = await eslint.lintFiles(['tools/lint-fixtures/bad-rule.ts']);
    expect(result).toBeDefined();
    const hits = result!.messages.filter((m) => m.message.includes('Math.random'));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.line).toBeGreaterThan(0);
    expect(result!.filePath.replace(/\\/g, '/')).toMatch(/tools\/lint-fixtures\/bad-rule\.ts$/);
  });

  it('is left out of the normal lint run', async () => {
    const eslint = new ESLint({ cwd: root });
    expect(await eslint.isPathIgnored('tools/lint-fixtures/bad-rule.ts')).toBe(true);
  });

  const banned = ['Date', 'performance', 'setTimeout', 'setInterval', 'requestAnimationFrame'];
  const folders = [
    'kit/core/src/x.ts',
    'kit/solver/src/x.ts',
    'kit/conformance/src/x.ts',
    'apps/garden/src/rules/x.ts',
    'apps/runner/src/rules/x.ts',
  ];

  it.each(folders)('applies to %s', async (filePath) => {
    const eslint = new ESLint({ cwd: root });
    const code = 'export const a = Math.random();\n';
    const [result] = await eslint.lintText(code, { filePath });
    expect(result!.messages.some((m) => m.message.includes('Math.random'))).toBe(true);
  });

  it.each(banned)('bans %s in rule code', async (name) => {
    const eslint = new ESLint({ cwd: root });
    const code = `export const a = typeof ${name};\n`;
    const [result] = await eslint.lintText(code, { filePath: 'kit/core/src/x.ts' });
    expect(result!.messages.some((m) => m.message.includes(name))).toBe(true);
  });

  it('does not apply to test files', async () => {
    const eslint = new ESLint({ cwd: root });
    const code = 'export const a = [Math.random(), new Date(), performance];\n';
    const [result] = await eslint.lintText(code, { filePath: 'kit/core/src/x.test.ts' });
    expect(result!.messages).toEqual([]);
  });

  it('does not apply to folders outside 9.1', async () => {
    const eslint = new ESLint({ cwd: root });
    const code = 'export const a = Math.random();\n';
    const [result] = await eslint.lintText(code, { filePath: 'kit/shell/src/x.ts' });
    expect(result!.messages).toEqual([]);
  });
});
