import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Requirement 1 of .kiro/specs/accessibility-scan. The test reads files only.

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts: string[]): string => readFileSync(join(REPO, ...parts), 'utf8');

// Every text file under a folder, skipping build output and installed packages.
function files(folder: string, found: string[] = []): string[] {
  if (!existsSync(folder)) return found;
  for (const name of readdirSync(folder)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const path = join(folder, name);
    if (statSync(path).isDirectory()) files(path, found);
    else if (/\.(ts|tsx|js|mjs|json|html|css)$/.test(name)) found.push(path);
  }
  return found;
}

function distFiles(folder: string, found: string[] = []): string[] {
  if (!existsSync(folder)) return found;
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (name === 'node_modules') continue;
    if (statSync(path).isDirectory()) distFiles(path, found);
    else found.push(path);
  }
  return found;
}

describe('the scan tool as a test only dependency', () => {
  it('the dependency rule allows MPL-2.0 for a test only tool', () => {
    const rule = read('.kiro', 'steering', 'kit-boundary.md');
    const line = rule.split('\n').find((l) => l.includes('A new dependency needs'));
    expect(line, 'the dependency line').toBeDefined();
    expect(line).toContain('MPL-2.0');
    expect(line).toContain('test only');
    expect(line).toContain('MIT, BSD, ISC or Apache 2.0');
  });

  it('package.json lists @axe-core/playwright as an exact devDependency', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    expect(pkg.devDependencies?.['@axe-core/playwright']).toBe('4.11.3');
    expect(pkg.dependencies?.['@axe-core/playwright']).toBeUndefined();
  });

  it('no file of the kit, the apps, the site or the build tools imports the package', () => {
    const roots = ['kit', 'apps', 'site', 'tools'].flatMap((f) => files(join(REPO, f)));
    const config = ['vite.config.ts', 'kit.config.json'].map((f) => join(REPO, f));
    const hits = [...roots, ...config].filter((f) => /axe-core/.test(readFileSync(f, 'utf8')) && !f.endsWith('.test.ts'));
    expect(hits).toEqual([]);
  });

  it('the built site holds no file of the package', () => {
    const hits = distFiles(join(REPO, 'dist')).filter((f) => /axe/i.test(f) || (/\.(js|html|css)$/.test(f) && /axe-core|axe\.min/.test(readFileSync(f, 'utf8'))));
    expect(hits).toEqual([]);
  });
});
