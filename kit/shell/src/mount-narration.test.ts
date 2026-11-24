// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameDef } from '@kit/core';
import { mountGame } from './index';
import type { InputMap, ProofSet } from './index';
import { neutralTheme } from './test-theme';
import { watchScreen } from './screens/watch-screen';

// The play screen keeps a text version of the state for a screen reader.

type FakeState = { total: number };
const def: GameDef<FakeState, string> = {
  id: 'fake-narration',
  title: 'Fake narration',
  rulesVersion: '1',
  kind: 'turn',
  levels: () => [{ id: 'lv-1', title: 'One' }],
  init: () => ({ total: 0 }),
  actions: (s) => (s.total >= 3 ? [] : ['add']),
  step: (s) => ({ total: s.total + 1 }),
  status: (s) => (s.total >= 3 ? { phase: 'won', score: s.total } : { phase: 'playing', score: s.total }),
  observe: (s) => ({ summary: `Observed total ${s.total}.`, facts: {} }),
  view: (_s, v) => ({ width: v.width, height: v.height, items: [{ kind: 'rect', id: 'item-1', layer: 'world', x: 0, y: 0, w: 40, h: 40, fill: '#336699' }] }),
  encodeAction: (a) => a,
  decodeAction: (t) => (t === 'add' ? t : null),
};

const input: InputMap<FakeState> = {
  idle: null,
  toAction: (e) => (e.type === 'key' && e.key === 'a' ? 'add' : null),
  buttons: [{ id: 'add', label: 'Add', action: 'add' }],
  anchorFor: () => null,
  lessons: [],
  narrate: (state, _previous, status) => (status.phase === 'won' ? `Done at ${state.total}.` : `Total is ${state.total}.`),
};
const plainInput: InputMap<FakeState> = { ...input };
delete plainInput.narrate;

const proofs: ProofSet = {
  loadIndex: () => Promise.reject(new Error('none')),
  load: () => Promise.reject(new Error('none')),
};

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  localStorage.clear();
});
afterEach(() => {
  document.body.innerHTML = '';
});

function play(map: InputMap<FakeState>): { root: HTMLElement; destroy(): void } {
  const root = document.getElementById('root')!;
  const handle = mountGame(root, { def, theme: neutralTheme(), input: map, proofs, texts: { reasons: {} }, credits: ['Made for tests'] });
  root.querySelector<HTMLElement>('[data-control="levels"]')?.click();
  root.querySelector<HTMLElement>('[data-control="level-lv-1"]')?.click();
  return { root, destroy: () => handle.destroy() };
}
const region = (root: HTMLElement): HTMLElement | null => root.querySelector('[data-screen="play"] [data-narration]');
const click = (root: HTMLElement, id: string): void => root.querySelector<HTMLElement>(`[data-control="${id}"]`)?.click();

describe('the text version of the play screen', () => {
  it('is a polite status region that a screen reader can find', () => {
    const { root, destroy } = play(input);
    const el = region(root);
    expect(el).not.toBeNull();
    expect(el?.getAttribute('role')).toBe('status');
    expect(el?.getAttribute('aria-live')).toBe('polite');
    expect(el?.hidden).toBe(false);
    expect(el?.getAttribute('aria-hidden')).toBeNull();
    destroy();
  });

  it('says the start state, then the state after a move and after Undo', () => {
    const { root, destroy } = play(input);
    expect(region(root)?.textContent).toBe('Total is 0.');
    click(root, 'add');
    expect(region(root)?.textContent).toBe('Total is 1.');
    click(root, 'add');
    expect(region(root)?.textContent).toBe('Total is 2.');
    click(root, 'undo');
    expect(region(root)?.textContent).toBe('Total is 1.');
    destroy();
  });

  it('says the result when the level ends', () => {
    const { root, destroy } = play(input);
    click(root, 'add');
    click(root, 'add');
    click(root, 'add');
    expect(region(root)?.textContent).toBe('Done at 3.');
    destroy();
  });

  it('disables Undo and keeps the result once the level is won', () => {
    const { root, destroy } = play(input);
    click(root, 'add');
    click(root, 'add');
    expect(root.querySelector<HTMLButtonElement>('[data-control="undo"]')?.disabled).toBe(false);
    click(root, 'add');
    expect(region(root)?.textContent).toBe('Done at 3.');
    const undo = root.querySelector<HTMLButtonElement>('[data-control="undo"]');
    expect(undo?.disabled).toBe(true);
    undo?.click();
    expect(region(root)?.textContent).toBe('Done at 3.');
    destroy();
  });

  it('enables Undo again for a new level start', () => {
    const { root, destroy } = play(input);
    expect(root.querySelector<HTMLButtonElement>('[data-control="undo"]')?.disabled).toBe(false);
    destroy();
  });

  it('falls back to the observation summary of the game when the game gives no words', () => {
    const { root, destroy } = play(plainInput);
    click(root, 'add');
    expect(region(root)?.textContent).toBe('Observed total 1.');
    destroy();
  });

  it('is on the watch screen too', () => {
    const view = watchScreen(document, { width: 360, height: 640, safe: { top: 0, right: 0, bottom: 0, left: 0 }, kind: 'turn', buttons: [], on: { back() {}, speed() {} } });
    const el = view.root.querySelector('[data-narration]');
    expect(el?.getAttribute('role')).toBe('status');
    expect(el?.getAttribute('aria-live')).toBe('polite');
    view.setNarration('Turn 1.');
    expect(el?.textContent).toBe('Turn 1.');
  });
});
