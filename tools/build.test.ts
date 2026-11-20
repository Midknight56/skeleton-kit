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

  it('names watch_end, the three results of level_end and the usage data switch on the privacy page', () => {
    const html = readFileSync(join(dist, 'privacy', 'index.html'), 'utf8');
    expect(html).toContain('<tr data-event="watch_end">');
    expect(html).toContain('won, lost or left');
    expect(html).toContain('Usage data');
  });

  it.each(['garden', 'runner'])('has a loading screen in the %s page before its script runs', (game) => {
    const html = readFileSync(join(dist, game, 'index.html'), 'utf8');
    const config = readFileSync(fileURLToPath(new URL(`../apps/${game}/game.config.ts`, import.meta.url)), 'utf8');
    const title = /title:\s*'([^']+)'/.exec(config)?.[1] ?? '';
    expect(title).not.toBe('');
    const body = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';
    const loading = /<div[^>]*data-screen="loading"[^>]*>[\s\S]*?<\/div>/.exec(body)?.[0] ?? '';
    expect(loading, 'the loading element in the body').not.toBe('');
    expect(body).toContain(title);
    // The style is inline, so the first frame has the colours of the game and no blank page. The build
    // minifies the style, so the patterns allow both forms.
    expect(html).toMatch(/<style>[\s\S]*\[data-screen="?loading"?\][\s\S]*@keyframes[\s\S]*<\/style>/);
    expect(html).toMatch(/html,\s*body\s*\{[^}]*background:\s*#[0-9a-f]{6}/);
    expect(html).not.toMatch(/background:\s*#(?:000000|ffffff|000|fff)\b/i);
    // The colours are the ones of the theme of the game.
    const theme = readFileSync(fileURLToPath(new URL(`../apps/${game}/theme.ts`, import.meta.url)), 'utf8');
    for (const name of ['background', 'primary']) {
      const colour = new RegExp(`${name}: '(#[0-9a-f]{6})'`).exec(theme)?.[1] ?? '';
      expect(colour, `${name} of the theme`).not.toBe('');
      expect(html, `${name} colour`).toContain(colour);
    }
  });

  it('has the loading screen in the source page of the lights example too', () => {
    const html = readFileSync(fileURLToPath(new URL('../examples/lights/index.html', import.meta.url)), 'utf8');
    expect(html).toMatch(/<body>[\s\S]*<div[^>]*data-screen="loading"[^>]*><h1>__GAME_TITLE__<\/h1>/);
    expect(html).toMatch(/@keyframes/);
    const theme = readFileSync(fileURLToPath(new URL('../examples/lights/theme.ts', import.meta.url)), 'utf8');
    expect(html).toContain(/background: '(#[0-9a-f]{6})'/.exec(theme)?.[1] ?? 'none');
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

  describe('level facts in the page', () => {
    const tagPattern = /<script type="application\/json" id="kit-level-facts">(.*?)<\/script>/s;
    const pageFacts = (id: string) => {
      const html = readFileSync(join(dist, id, 'index.html'), 'utf8');
      const text = tagPattern.exec(html)?.[1];
      expect(text, `dist/${id}/index.html has no kit-level-facts tag. Run npm run build.`).toBeDefined();
      return JSON.parse(text ?? '') as { game: string; levels: Record<string, { actions: number; firstMoves?: unknown }> };
    };
    const index = (id: string) =>
      JSON.parse(readFileSync(fileURLToPath(new URL(`../proofs/${id}/index.json`, import.meta.url)), 'utf8')) as {
        levels: { id: string; actions: number; firstMoves?: unknown }[];
      };

    it('holds the garden proof numbers for all 12 levels, equal to the index', () => {
      const facts = pageFacts('garden');
      const items = index('garden').levels;
      expect(items).toHaveLength(12);
      expect(Object.keys(facts.levels)).toHaveLength(12);
      for (const item of items) {
        expect(facts.levels[item.id]).toEqual({ actions: item.actions, firstMoves: item.firstMoves });
      }
    });

    it('holds actions only for the runner, with no firstMoves', () => {
      const facts = pageFacts('runner');
      for (const item of index('runner').levels) expect(facts.levels[item.id]).toEqual({ actions: item.actions });
      expect(readFileSync(join(dist, 'runner', 'index.html'), 'utf8')).not.toContain('firstMoves');
    });

    it('holds no tag on the landing page', () => {
      expect(readFileSync(join(dist, 'index.html'), 'utf8')).not.toContain('kit-level-facts');
    });
  });

  it('copies both fonts and their licences to dist/fonts, one path for every page', () => {
    for (const file of ['BricolageGrotesque.ttf', 'SometypeMono.ttf', 'OFL-BricolageGrotesque.txt', 'OFL-SometypeMono.txt']) {
      expect(existsSync(join(dist, 'fonts', file)), `dist/fonts/${file} is missing. Run npm run build.`).toBe(true);
    }
    expect(readFileSync(join(dist, 'fonts', 'OFL-SometypeMono.txt'), 'utf8')).toMatch(/SIL OPEN FONT LICENSE Version 1\.1/i);
  });

  it('loads each font from a relative url that reaches a file of dist, on every page', () => {
    const pages: [string, string][] = [['index.html', './fonts/'], ['privacy/index.html', '../fonts/'], ['garden/index.html', '../fonts/'], ['runner/index.html', '../fonts/']];
    for (const [page, dir] of pages) {
      const folder = join(dist, page, '..');
      const html = readFileSync(join(dist, page), 'utf8');
      const assets = join(folder, 'assets');
      const css = [html, ...(existsSync(assets) ? walk(assets) : []).filter((f) => f.endsWith('.css') || f.endsWith('.js')).map((f) => readFileSync(f, 'utf8'))].join('\n');
      const urls = Array.from(css.matchAll(/url\(\s*\\?["']?([^"')\\]*\.ttf)/g), (m) => m[1] as string);
      // A game page builds the url at run time from the folder and the file name, so the bundle holds the two parts.
      if (page.startsWith('garden') || page.startsWith('runner')) {
        expect(css, `${page} holds the font folder`).toContain(`\`${dir}\``);
        for (const file of ['BricolageGrotesque.ttf', 'SometypeMono.ttf']) {
          expect(css, `${page} holds ${file}`).toContain(file);
          urls.push(`${dir}${file}`);
        }
      }
      expect(urls.length, `${page} has font urls`).toBeGreaterThanOrEqual(2);
      for (const url of urls) {
        expect(url.startsWith(dir), `${page}: ${url}`).toBe(true);
        expect(existsSync(join(folder, url)), `${page}: ${url} reaches no file`).toBe(true);
      }
    }
  });

  it('keeps every page free of a font, style or script request to another host', () => {
    const hosts = walk(dist)
      .filter((file) => /\.(html|css)$/.test(file) || (file.endsWith('.js') && !file.includes('proofs')))
      .flatMap((file) => Array.from(readFileSync(file, 'utf8').matchAll(/fonts\.(googleapis|gstatic)\.com/g), (m) => `${file.slice(dist.length + 1)}: ${m[0]}`));
    expect(hosts).toEqual([]);
  });

  it('loads nothing from another site', () => {
    expect(existsSync(dist), 'dist/ is missing. Run npm run build.').toBe(true);
    const problems = walk(dist)
      .filter((file) => /\.(html|js|mjs|css)$/.test(file))
      .flatMap((file) => remoteLoads(file.slice(dist.length + 1), readFileSync(file, 'utf8')));
    expect(problems).toEqual([]);
  });
});
