import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BEACON_EVENTS } from '../kit/shell/src/beacon-events';

// These tests read `dist/`. `npm run build` makes it, and `npm run verify` runs it first.
const dist = fileURLToPath(new URL('../dist', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const remote = /^(?:https?:)?\/\//i;

// Loads from another site: src, stylesheet href, url() and @import. A plain <a href> is not a load.
function remoteLoads(file: string, text: string): string[] {
  const found: string[] = [];
  const add = (kind: string, value: string): void => {
    if (remote.test(value.trim())) found.push(`${file}: ${kind} ${value.trim()}`);
  };
  if (file.endsWith('.html')) {
    for (const m of text.matchAll(/<[^>]*\ssrc\s*=\s*["']([^"']*)["']/gi)) add('src', m[1] ?? '');
    for (const m of text.matchAll(/<link\b[^>]*>/gi)) {
      const tag = m[0];
      if (!/rel\s*=\s*["'][^"']*(stylesheet|modulepreload|preload|icon)/i.test(tag)) continue;
      const href = /\shref\s*=\s*["']([^"']*)["']/i.exec(tag);
      if (href) add('href', href[1] ?? '');
    }
  }
  for (const m of text.matchAll(/url\(\s*["']?([^"')]*)["']?\s*\)/gi)) add('url()', m[1] ?? '');
  for (const m of text.matchAll(/@import\s*(?:url\(\s*)?["']?([^"');\s]*)/gi)) add('@import', m[1] ?? '');
  for (const m of text.matchAll(/(?<![@\w])import\s*\(?\s*["'](https?:\/\/[^"']*|\/\/[^"']*)["']/gi)) add('import', m[1] ?? '');
  return found;
}

describe('remoteLoads', () => {
  it('finds each kind of load from another site', () => {
    const html = '<script src="https://x.test/a.js"></script><link rel="stylesheet" href="//x.test/a.css"><style>a{background:url(http://x.test/i.png)}@import "https://x.test/b.css";</style>';
    expect(remoteLoads('t.html', html)).toHaveLength(4);
  });

  it('ignores a plain link and an XML namespace', () => {
    const html = '<a href="https://example.test/">x</a><svg xmlns="http://www.w3.org/2000/svg"></svg><script src="./a.js"></script>';
    expect(remoteLoads('t.html', html)).toEqual([]);
  });
});

describe('the build output', () => {
  it('has dist/garden/index.html', () => {
    expect(existsSync(join(dist, 'garden', 'index.html')), 'dist/garden/index.html is missing. Run npm run build.').toBe(true);
  });

  it('has the four pages: /, /garden/, /runner/ and /privacy/', () => {
    for (const page of ['index.html', 'garden/index.html', 'runner/index.html', 'privacy/index.html']) {
      expect(existsSync(join(dist, page)), `dist/${page} is missing. Run npm run build.`).toBe(true);
    }
  });

  it('has a landing page with the frame of the watch run, the cards and the link to the repository', () => {
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    expect(html).toMatch(/<iframe[^>]*src="\.\/garden\/\?watch=g03"/);
    expect(html).toMatch(/href="\.\/garden\/"/);
    expect(html).toMatch(/href="\.\/runner\/"/);
    expect(html).toMatch(/data-link="repository"/);
    expect(html).toMatch(/<script[^>]*src="\.\/assets\/[^"]+\.js"/);
  });

  it('has a privacy page that lists every beacon event with its fields, the storage keys and the address line', () => {
    const html = readFileSync(join(dist, 'privacy', 'index.html'), 'utf8');
    expect(html).not.toContain('<!--');
    for (const spec of BEACON_EVENTS) {
      const row = new RegExp(`<tr data-event="${spec.event}">[\\s\\S]*?</tr>`).exec(html)?.[0] ?? '';
      expect(row, `row of ${spec.event}`).not.toBe('');
      for (const field of spec.fields) expect(row, `${spec.event} field ${field}`).toContain(`<code>${field}</code>`);
      expect(row).toContain(spec.says);
    }
    expect(html).toContain('kit.garden.v1');
    expect(html).toContain('kit.runner.v1');
    expect(html).toContain('The server that receives these events sees the address of the request, as any server does.');
    expect(html).toContain('VITE_BEACON_URL');
  });

  it('has dist/runner/index.html', () => {
    expect(existsSync(join(dist, 'runner', 'index.html')), 'dist/runner/index.html is missing. Run npm run build.').toBe(true);
  });

  it('holds no solver code in the runner page bundle', () => {
    const folder = join(dist, 'runner');
    expect(existsSync(folder), 'dist/runner is missing. Run npm run build.').toBe(true);
    const scripts = walk(folder).filter((file) => file.endsWith('.js'));
    expect(scripts.length).toBeGreaterThan(0);
    for (const file of scripts) expect(readFileSync(file, 'utf8'), file).not.toMatch(/solveTick|solveTurn/);
  });

  it('copies the proofs to dist/proofs', () => {
    expect(existsSync(join(dist, 'proofs', 'garden', 'index.json')), 'dist/proofs/garden/index.json is missing.').toBe(true);
  });

  it('loads nothing from another site', () => {
    expect(existsSync(dist), 'dist/ is missing. Run npm run build.').toBe(true);
    const problems = walk(dist)
      .filter((file) => /\.(html|js|mjs|css)$/.test(file))
      .flatMap((file) => remoteLoads(file.slice(dist.length + 1), readFileSync(file, 'utf8')));
    expect(problems).toEqual([]);
  });
});
