// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { themeCss } from '../styles';
import { neutralTheme } from '../test-theme';
import { confirmBox } from './confirm';
import { creditsScreen } from './credits';
import { howScreen } from './how';
import { levelsScreen } from './levels';
import { pauseScreen } from './pause';
import { resultsScreen } from './results';
import { settingsScreen } from './settings';
import { titleScreen } from './title';

const noop = () => undefined;

const menus: [string, () => HTMLElement][] = [
  ['title', () => titleScreen(document, { title: 'T', showNotice: true, on: { play: noop, levels: noop, how: noop, settings: noop, credits: noop, watch: noop } })],
  ['levels', () => levelsScreen(document, { levels: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], stars: () => 0, onPick: noop, onBack: noop })],
  ['how', () => howScreen(document, { lessons: [{ id: 'l', anchor: 'x', text: 'Tap here' }], keys: ['Space: wait'], onBack: noop })],
  ['credits', () => creditsScreen(document, { lines: ['One', 'Two'], onBack: noop })],
  ['settings', () => settingsScreen(document, { settings: { sound: true, music: true, usage: true }, onToggle: noop, onReset: noop, onBack: noop })],
  ['pause', () => pauseScreen(document, { onResume: noop, onRetry: noop, onLevels: noop })],
  ['results won', () => resultsScreen(document, { won: true, reason: undefined, reasons: {}, stars: 2, hasNext: true, on: { next: noop, retry: noop, levels: noop } })],
  ['results lost', () => resultsScreen(document, { won: false, reason: 'x', reasons: { x: 'Out of turns' }, stars: 0, hasNext: false, on: { next: noop, retry: noop, levels: noop } })],
];

const confirm = () => confirmBox(document, { message: 'Leave this run?', confirmLabel: 'Leave', cancelLabel: 'Stay', onConfirm: noop, onCancel: noop });

describe('menu column', () => {
  for (const [name, make] of menus) {
    it(`${name}: every button that is not a level tile sits in one column`, () => {
      const root = make();
      const columns = Array.from(root.querySelectorAll('[data-column]'));
      expect(columns.length, 'one column').toBe(1);
      const inColumn = Array.from(columns[0]!.querySelectorAll('[data-control]'));
      expect(inColumn.length).toBeGreaterThan(0);
      const loose = Array.from(root.querySelectorAll<HTMLElement>('[data-control]')).filter((b) => !inColumn.includes(b) && !b.dataset.control?.startsWith('level-'));
      expect(loose.map((b) => b.dataset.control)).toEqual([]);
    });

    it(`${name}: no button of the column has a width of its own, so the column sets one width`, () => {
      const root = make();
      for (const b of Array.from(root.querySelectorAll<HTMLElement>('[data-column] [data-control]'))) {
        expect(b.style.width, b.dataset.control).toBe('');
        expect(b.style.minWidth, b.dataset.control).toBe('');
      }
    });
  }

  it('the confirm box has its buttons in one column', () => {
    const columns = Array.from(confirm().querySelectorAll('[data-column]'));
    expect(columns.length).toBe(1);
    expect(Array.from(columns[0]!.querySelectorAll('[data-control]')).map((b) => (b as HTMLElement).dataset.control)).toEqual(['confirm', 'cancel']);
  });

  it('keeps the order of the buttons', () => {
    const root = settingsScreen(document, { settings: { sound: true, music: true, usage: true }, onToggle: noop, onReset: noop, onBack: noop });
    const ids = Array.from(root.querySelectorAll<HTMLElement>('[data-column] [data-control]')).map((b) => b.dataset.control);
    expect(ids).toEqual(['sound', 'music', 'usage', 'privacy', 'reset', 'back']);
  });

  it('css gives the column one shared width: as wide as its widest button, every button stretched to it', () => {
    const css = themeCss(neutralTheme());
    const rule = /\[data-column\] \{([^}]*)\}/.exec(css);
    expect(rule, 'a rule for [data-column]').not.toBeNull();
    expect(rule![1]).toMatch(/display: grid;/);
    expect(rule![1]).toMatch(/width: max-content;/);
    expect(rule![1]).toMatch(/justify-items: stretch;/);
    expect(rule![1]).toMatch(/max-width: 100%;/);
  });
});

describe('menu card', () => {
  for (const [name, make] of menus) {
    it(`${name}: the root is a card with a heading and no empty band after it`, () => {
      const root = make();
      expect(root.hasAttribute('data-card'), 'data-card').toBe(true);
      expect(root.querySelector('h1')).not.toBeNull();
    });
  }

  it('the confirm box holds its own card, and keeps its dialog role', () => {
    const box = confirm();
    expect(box.dataset.dialog).toBe('confirm');
    expect(box.getAttribute('role')).toBe('dialog');
    expect(box.querySelector(':scope > [data-card]')).not.toBeNull();
  });

  it('css centres the card as a whole and no longer pushes the heading to the top', () => {
    const css = themeCss(neutralTheme());
    expect(css).not.toMatch(/margin-bottom: auto/);
    const rule = /\[data-card\] \{([^}]*)\}/.exec(css);
    expect(rule, 'a rule for [data-card]').not.toBeNull();
    expect(rule![1]).toMatch(/margin: 16px;/);
    expect(rule![1]).toMatch(/max-width: calc\(100vw - 32px\);/);
    expect(rule![1]).toMatch(/border-radius: 16px;/);
    expect(css).toMatch(/\[data-kit-root\] \{[^}]*align-items: safe center;[^}]*justify-content: safe center;/);
  });

  it('css keeps the play and watch screens out of the card', () => {
    const css = themeCss(neutralTheme());
    expect(css).toMatch(/\[data-screen="play"\], \[data-screen="watch"\] \{[^}]*--u: 1px/);
    expect(css).not.toMatch(/\[data-screen="play"\][^{]*\[data-card\]/);
  });

  it('css makes the card of a theme with no art a plain colour, with no gradient', () => {
    const rule = /\[data-card\] \{([^}]*)\}/.exec(themeCss(neutralTheme()))![1]!;
    expect(rule).not.toMatch(/gradient/);
    expect(rule).toMatch(/background: color-mix\(/);
  });

  it('css paints the art of the theme over the card colour', () => {
    const art = 'radial-gradient(circle at 50% 0%, #ffffff 0%, transparent 70%)';
    const rule = /\[data-card\] \{([^}]*)\}/.exec(themeCss({ ...neutralTheme(), cardArt: art }))![1]!;
    const at = rule.indexOf(art);
    expect(at).toBeGreaterThan(-1);
    expect(rule.lastIndexOf('color-mix(')).toBeGreaterThan(at);
  });

  it('css gives level tiles one width', () => {
    expect(themeCss(neutralTheme())).toMatch(/\.tiles button \{[^}]*width: calc\(88 \* var\(--u\)\);/);
  });
});
