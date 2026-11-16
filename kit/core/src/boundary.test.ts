import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const kitDir = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listTs(full));
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out.sort();
}

// Finds the module text of each import, export-from and bare import.
export function importsOf(text: string): string[] {
  const found: string[] = [];
  const pattern = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^'"\n;]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
  for (const m of text.matchAll(pattern)) found.push(m[1]!);
  return found;
}

const isRelative = (spec: string) => spec.startsWith('./') || spec.startsWith('../');
const testOnly = new Set(['vitest', 'fast-check', 'node:fs', 'node:path']);

describe('kit/core boundary', () => {
  it('lists no runtime dependency', () => {
    const pkg = JSON.parse(readFileSync(join(kitDir, 'core', 'package.json'), 'utf8')) as Record<string, unknown>;
    for (const key of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      const value = pkg[key];
      expect(value === undefined || Object.keys(value as object).length === 0, key).toBe(true);
    }
  });

  it('imports only relative paths in source files', () => {
    const files = listTs(join(kitDir, 'core', 'src')).filter((f) => !f.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      for (const spec of importsOf(readFileSync(file, 'utf8'))) {
        expect(isRelative(spec), `${relative(kitDir, file)} imports ${spec}`).toBe(true);
      }
    }
  });

  it('imports only relative paths, vitest, fast-check, node:fs or node:path in test files', () => {
    const files = listTs(join(kitDir, 'core', 'src')).filter((f) => f.endsWith('.test.ts'));
    for (const file of files) {
      for (const spec of importsOf(readFileSync(file, 'utf8'))) {
        const ok = isRelative(spec) || testOnly.has(spec);
        expect(ok, `${relative(kitDir, file)} imports ${spec}`).toBe(true);
      }
    }
  });

  it('keeps kit/core files from importing out of kit/core', () => {
    for (const file of listTs(join(kitDir, 'core'))) {
      for (const spec of importsOf(readFileSync(file, 'utf8'))) {
        if (!isRelative(spec)) continue;
        const target = join(file, '..', spec);
        expect(relative(join(kitDir, 'core'), target).startsWith('..'), `${relative(kitDir, file)} imports ${spec}`).toBe(false);
      }
    }
  });

  it('lets kit/conformance reach kit/core only through @kit/core', () => {
    const files = listTs(join(kitDir, 'conformance'));
    expect(files.length).toBeGreaterThan(5);
    let seen = 0;
    for (const file of files) {
      for (const spec of importsOf(readFileSync(file, 'utf8'))) {
        const touchesCore = spec.startsWith('@kit/core') || /(^|\/)core(\/|$)/.test(spec);
        if (!touchesCore) continue;
        seen += 1;
        expect(spec, `${relative(kitDir, file)} imports ${spec}`).toBe('@kit/core');
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('finds an import of a deep path (planted text)', () => {
    expect(importsOf("import { x } from '@kit/core/src/hash';\nexport * from './a';\nimport 'b';\n")).toEqual([
      '@kit/core/src/hash',
      './a',
      'b',
    ]);
  });
});
