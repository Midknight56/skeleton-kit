import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { gardenTheme } from '../../apps/garden/theme';
import { runnerTheme } from '../../apps/runner/theme';
import { measuredPairsOf, pairsOf } from './contrast-pairs';

// Task 1 of .kiro/specs/menu-contrast-preview. The test reads the saved report and writes nothing.

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const games = [['garden', gardenTheme], ['runner', runnerTheme]] as const;

describe('the shared contrast calculation', () => {
  it('gives 27 pairs for each game', () => {
    for (const [game, theme] of games) expect(pairsOf(game, theme)).toHaveLength(27);
  });

  it('gives the pairs the saved report holds, in the same order and shape', () => {
    const report = JSON.parse(readFileSync(join(REPO, 'docs', 'acceptance', 'a11y', 'contrast.json'), 'utf8')) as { entries: unknown[] };
    expect(games.flatMap(([game, theme]) => pairsOf(game, theme))).toEqual(report.entries);
  });

  it('keeps the full precision ratio, and the saved ratio is that ratio cut to 2 decimals', () => {
    for (const [game, theme] of games) {
      for (const pair of measuredPairsOf(game, theme)) {
        expect(pair.ratio, pair.name).toBe(Math.floor(pair.exact * 100) / 100);
        expect(pair.result, pair.name).toBe(pair.exact >= pair.limit ? 'pass' : 'fail');
      }
    }
  });
});
