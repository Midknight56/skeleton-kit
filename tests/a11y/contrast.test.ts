import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { gardenTheme } from '../../apps/garden/theme';
import { runnerTheme } from '../../apps/runner/theme';
import type { Theme } from '../../kit/shell/src/theme';
import { contrast, judge, pairsOf, textLimit } from './contrast-pairs';

// Task 5 of .kiro/specs/accessibility-scan. axe lists color-contrast as incomplete on every screen,
// because the text sits on gradients and pictures. This test computes the WCAG 2.1 contrast ratio
// itself with the pairs of tests/a11y/contrast-pairs.ts, the file that the power menu-contrast-preview
// also uses. Only this test writes docs/acceptance/a11y/contrast.json.

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPORT = join(REPO, 'docs', 'acceptance', 'a11y', 'contrast.json');

const NOT_COVERED = [
  'Text that the painter draws on the canvas (the labels of the play screen) is not covered. The painter in kit/shell/src/painter.ts has no text call, so no colour of it could be added. Any text a game draws inside its own scene is not covered.',
  'The watch proof line is tested against the page sky. What the game scene draws under that row of the canvas is not covered.',
  'The stars of the sky and the moon of the menu screens are not tested as backgrounds. The stars are 1 px dots. The moon sits in a corner and no rule keeps text off it.',
  'The title puppets are not tested as backgrounds. The shell hides every puppet that comes within 24 px of a heading, a paragraph or the menu column (backdrop.ts, keepClear).',
  'Buttons are tested for their label and icon. The edge of a plum button against the sky is not tested, because the label names the control. Disabled buttons and the opacity of a locked tile are not applied, because WCAG 1.4.3 exempts inactive controls.',
  'Sizes are read at the smallest size of the menu screens (--u of 1px). A larger screen only makes text bigger.',
  'The decorative card border, the strings and the garland pictures are not tested. They carry no information.',
  'A ratio is a calculation. It says nothing about how real users see the screen.',
];

const games: [string, Theme][] = [['garden', gardenTheme], ['runner', runnerTheme]];
const all = games.flatMap(([game, theme]) => pairsOf(game, theme));

describe('the WCAG 2.1 formula', () => {
  it('gives 21 for black on white and 1 for equal colours', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([120, 90, 200], [120, 90, 200])).toBeCloseTo(1, 5);
  });

  it('gives 4.54 for #767676 on white, a value known from the WCAG documents', () => {
    expect(contrast([0x76, 0x76, 0x76], [255, 255, 255])).toBeCloseTo(4.54, 2);
  });

  it('marks a pair under its limit as a fail', () => {
    expect(judge('same colour', [239, 231, 210], [239, 231, 210], 'x', 4.5).result).toBe('fail');
  });

  it('calls 18.66 px bold and 24 px large, and 18 px bold normal', () => {
    expect(textLimit(18.66, 700).limit).toBe(3);
    expect(textLimit(24, 400).limit).toBe(3);
    expect(textLimit(18, 700).limit).toBe(4.5);
    expect(textLimit(34, 400).limit).toBe(3);
  });
});

describe('contrast of the colours the shell uses', () => {
  it('lists every pair with its ratio and writes docs/acceptance/a11y/contrast.json', () => {
    const lowest = all.reduce((a, b) => (b.ratio < a.ratio ? b : a));
    const report = {
      tool: 'tests/a11y/contrast.test.ts, WCAG 2.1 relative luminance, no package',
      limits: { normalText: 4.5, largeTextAndControlBordersAndIcons: 3 },
      pairs: all.length,
      failing: all.filter((p) => p.result === 'fail').length,
      lowestRatio: { name: lowest.name, ratio: lowest.ratio },
      notCovered: NOT_COVERED,
      entries: all,
    };
    mkdirSync(dirname(REPORT), { recursive: true });
    writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8');
    for (const p of all) console.log(`${p.result.toUpperCase()}  ${p.ratio.toFixed(2).padStart(6)} (min ${p.limit})  ${p.name}  ${p.foreground} on ${p.background}  ${p.size}`);
    expect(all.length).toBeGreaterThan(30);
  });

  it('has the pip pairs of the level cards for both games, with theme colours only', () => {
    for (const [game, theme] of games) {
      const filled = all.find((p) => p.name === `${game}: level card filled pip on the card fill`);
      const empty = all.find((p) => p.name === `${game}: level card empty pip border on the card fill`);
      expect(filled, `${game} filled pip pair`).toBeDefined();
      expect(empty, `${game} empty pip pair`).toBeDefined();
      expect(filled?.foreground).toBe(theme.palette.accent.toLowerCase().slice(0, 7));
      expect(empty?.foreground).toBe(theme.palette.text.toLowerCase().slice(0, 7));
      expect(filled?.limit).toBe(3);
      expect(empty?.limit).toBe(3);
    }
  });

  it('has no pair under its limit', () => {
    const failing = all.filter((p) => p.result === 'fail').map((p) => `${p.name}: ${p.foreground} on ${p.background} is ${p.ratio}, needs ${p.limit} (${p.size})`);
    expect(failing).toEqual([]);
  });
});
