import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { checkVersions } from './check-versions.mjs';

const script = fileURLToPath(new URL('./check-versions.mjs', import.meta.url));
const made: string[] = [];

function fixture(versions: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'versions-'));
  made.push(root);
  for (const [path, version] of Object.entries(versions)) {
    const file = join(root, path);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ name: 'x', version }, null, 2)}\n`, 'utf8');
  }
  return root;
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('check-versions', () => {
  it('passes a fixture whose versions are all below 1.0.0', () => {
    const root = fixture({ 'package.json': '0.9.9', 'kit/a/package.json': '0.1.0' });
    expect(checkVersions(root)).toEqual([]);
  });

  it('fails 1.0.0 and names the file', () => {
    const root = fixture({ 'package.json': '0.1.0', 'kit/a/package.json': '1.0.0' });
    const problems = checkVersions(root);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('kit/a/package.json');
    expect(problems[0]).toContain('1.0.0');
  });

  it('fails 1.2.0 and names the file', () => {
    const root = fixture({ 'package.json': '1.2.0' });
    const problems = checkVersions(root);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('package.json');
    expect(problems[0]).toContain('1.2.0');
  });

  it('skips node_modules and dist', () => {
    const root = fixture({ 'package.json': '0.1.0', 'node_modules/x/package.json': '4.0.0', 'dist/y/package.json': '2.0.0' });
    expect(checkVersions(root)).toEqual([]);
  });

  it('exits 1 from the command line when a version is 1.0.0 or higher', () => {
    const root = fixture({ 'package.json': '1.0.0' });
    const bad = spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('package.json');
    const good = fixture({ 'package.json': '0.9.9' });
    expect(spawnSync(process.execPath, [script, good], { encoding: 'utf8' }).status).toBe(0);
  });
});
