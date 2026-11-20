import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Tasks 1 and 2 of .kiro/specs/readme-hero. The test reads files only. It starts no browser.

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PNG = join(REPO, 'docs', 'img', 'hero.png');
const TOOL = join(REPO, 'tools', 'capture-hero.mjs');

function pngSize(): { width: number; height: number } {
  const bytes = readFileSync(PNG);
  expect(bytes.subarray(0, 8).toString('hex'), 'PNG signature').toBe('89504e470d0a1a0a');
  expect(bytes.subarray(12, 16).toString('latin1'), 'first chunk').toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('the hero image', () => {
  it('exists, is a PNG, and is at least 1600 wide and 900 high', () => {
    expect(existsSync(PNG), 'docs/img/hero.png exists').toBe(true);
    const size = pngSize();
    expect(size.width).toBeGreaterThanOrEqual(1600);
    expect(size.height).toBeGreaterThanOrEqual(900);
  });
});

describe('tools/capture-hero.mjs', () => {
  const source = existsSync(TOOL) ? readFileSync(TOOL, 'utf8') : '';

  it('exists', () => {
    expect(existsSync(TOOL), 'tools/capture-hero.mjs exists').toBe(true);
  });

  it('runs headless with audio muted, reads free memory first and serves dist with serve-dist.mjs', () => {
    expect(source).toContain('headless: true');
    expect(source).toContain('--mute-audio');
    expect(source).toContain('freemem');
    expect(source.indexOf('freemem')).toBeLessThan(source.indexOf('chromium.launch'));
    expect(source).toContain('serve-dist.mjs');
    expect(source).toContain('@playwright/test');
  });

  it('never uses the ports of the test servers and builds nothing', () => {
    expect(source).toMatch(/4173/); // named only to be refused
    expect(source).toMatch(/new Set\(\[4173, 4177\]\)/);
    expect(source).not.toMatch(/npm run build|tools\/build\.mjs|build\.mjs|vite build/);
    expect(source).not.toMatch(/\bheadless: false\b/);
  });

  it('puts no label of its own on the picture', () => {
    expect(source).not.toMatch(/<(h1|h2|h3|p|span|figcaption|label)\b/);
  });
});

describe('the top of README.md', () => {
  const top = readFileSync(join(REPO, 'README.md'), 'utf8').split('\n').slice(0, 25).join('\n');

  it('holds the image link to docs/img/hero.png with alt text that says what it shows', () => {
    const match = /!\[([^\]]+)\]\(docs\/img\/hero\.png\)/.exec(top);
    expect(match, 'an image link to docs/img/hero.png in the first 25 lines').not.toBeNull();
    const alt = match?.[1] ?? '';
    expect(alt).toMatch(/landing page/i);
    expect(alt).toMatch(/in play/i);
    expect(alt).toMatch(/level select/i);
    expect(alt).toMatch(/pips/i);
  });

  it('holds the play link and the video link', () => {
    expect(top).toContain('https://skeleton-kit-games.pages.dev');
    expect(top).toContain('https://youtu.be/AU-yrIBvsuA');
  });

  it('puts the image right under the title', () => {
    const lines = top.split('\n');
    expect(lines[0]).toBe('# Skeleton kit');
    const image = lines.findIndex((line) => line.startsWith('![') && line.includes('docs/img/hero.png'));
    expect(image).toBeGreaterThan(0);
    expect(image).toBeLessThanOrEqual(2);
  });
});