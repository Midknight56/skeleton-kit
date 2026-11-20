import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Task 5 of .kiro/specs/difficulty-display. The README says what the level facts are, and claims only
// what the proof shows. The test reads files only.

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readme = readFileSync(join(REPO, 'README.md'), 'utf8');
const paragraphs = readme.split(/\n\s*\n/);
const paragraph = paragraphs.find((p) => p.includes('tools/level-facts.mjs')) ?? '';

describe('the README paragraph on level facts', () => {
  it('exists and comes right after the Innovation paragraph', () => {
    expect(paragraph, 'a paragraph names tools/level-facts.mjs').not.toBe('');
    const innovation = paragraphs.findIndex((p) => p.startsWith('**Innovation/Idea.**'));
    expect(innovation).toBeGreaterThanOrEqual(0);
    expect(paragraphs.indexOf(paragraph)).toBe(innovation + 1);
  });

  it('names the proof index, the pure function and the build step', () => {
    for (const path of ['proofs/garden/index.json', 'kit/shell/src/difficulty.ts', 'tools/level-facts.mjs']) expect(paragraph).toContain(path);
  });

  it('says the numbers are facts of the proof, that a level can be won, and nothing about how it feels', () => {
    expect(paragraph).toMatch(/facts of the proof/);
    expect(paragraph).toMatch(/npm run prove/);
    expect(paragraph).toMatch(/pips/);
    expect(paragraph).toMatch(/can be won/);
    expect(paragraph).toMatch(/not how it feels/);
  });

  it('holds no word of opinion', () => {
    expect(paragraph).not.toMatch(/\b(easy|hard|fun|tough|safe)\b/i);
  });

  it('lists level facts in the kit/shell row of the kit table', () => {
    const row = readme.split('\n').find((line) => line.startsWith('| `kit/shell` |')) ?? '';
    expect(row).toContain('level facts');
  });
});