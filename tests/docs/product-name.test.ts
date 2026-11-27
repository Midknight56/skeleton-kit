import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Task 1 of .kiro/specs/product-name. The product is "Skeleton Kit", with a capital K. The test reads
// files only. It finds the small k spelling in the text of site/, power/, apps/, kit/ and tools/.

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts: string[]): string => readFileSync(join(REPO, ...parts), 'utf8');

const WRONG = 'Skeleton ' + 'kit';
const RIGHT = 'Skeleton Kit';
const FOLDERS = ['site', 'power', 'apps', 'kit', 'tools'];
const SKIP = new Set(['node_modules', 'dist', '.wrangler', 'test-results']);
const TEXT = new Set(['.html', '.css', '.md', '.json', '.ts', '.mjs', '.js', '.svg', '.txt']);

function textFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...textFiles(path));
    else if (TEXT.has(extname(entry.name))) found.push(path);
  }
  return found;
}

function hits(): string[] {
  const found: string[] = [];
  for (const folder of FOLDERS) {
    for (const path of textFiles(join(REPO, folder))) {
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        if (line.includes(WRONG)) found.push(`${relative(REPO, path).replaceAll('\\', '/')}:${i + 1}`);
      });
    }
  }
  return found;
}

describe('the product name is Skeleton Kit', () => {
  it('no text file in site, power, apps, kit or tools writes it with a small k', () => {
    expect(hits()).toEqual([]);
  });

  it('the page title, the logo label and the logo text of the site say Skeleton Kit', () => {
    const html = read('site', 'index.html');
    expect(html).toContain(`<title>${RIGHT}</title>`);
    expect(html).toContain(`<a class="logo" href="./" aria-label="${RIGHT}">`);
    expect(html).toMatch(new RegExp(`</svg>\\n\\s+${RIGHT}\\n\\s+</a>`));
  });

  it('the power says Skeleton Kit in its description, its README heading and its skill description', () => {
    const plugin = JSON.parse(read('power', 'skeleton-kit', 'plugin.json')) as { name: string; description: string };
    expect(plugin.name).toBe('skeleton-kit');
    expect(plugin.description).toContain(RIGHT);
    expect(read('power', 'skeleton-kit', 'README.md').split('\n')[0]).toBe(`# ${RIGHT} power`);
    const skill = read('power', 'skeleton-kit', 'skills', 'play-and-prove', 'SKILL.md');
    expect(skill.split('\n').find((line) => line.startsWith('description:'))).toContain(RIGHT);
  });

  it('the names that must not change are still there', () => {
    const plugin = JSON.parse(read('power', 'skeleton-kit', 'plugin.json')) as { name: string; keywords: string[] };
    expect(plugin.name).toBe('skeleton-kit');
    expect(plugin.keywords).toContain('skeleton kit');
    expect(read('power', 'skeleton-kit', 'README.md')).toContain('kiro-cli powers uninstall skeleton-kit');
    expect(read('power', 'skeleton-kit', 'mcp.json')).toContain('SKELETON_KIT_GAME');
  });
});
