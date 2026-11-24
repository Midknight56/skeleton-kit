// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameDef } from '@kit/core';
import { mountGame } from './index';
import type { InputMap, ProofSet } from './index';
import { neutralTheme } from './test-theme';

// After Undo the hint of the first level matches the state again.

type FakeState = { total: number };
const def: GameDef<FakeState, string> = {
  id: 'fake-lessons',
  title: 'Fake lessons',
  rulesVersion: '1',
  kind: 'turn',
  levels: () => [{ id: 'lv-1', title: 'One' }],
  init: () => ({ total: 0 }),
  actions: (s) => (s.total >= 5 ? [] : ['add']),
  step: (s) => ({ total: s.total + 1 }),
  status: (s) => (s.total >= 5 ? { phase: 'won', score: s.total } : { phase: 'playing', score: s.total }),
  observe: (s) => ({ summary: `total ${s.total}`, facts: {} }),
  view: (_s, v) => ({ width: v.width, height: v.height, items: [{ kind: 'rect', id: 'item-1', layer: 'world', x: 0, y: 0, w: 40, h: 40, fill: '#336699' }] }),
  encodeAction: (a) => a,
  decodeAction: (t) => (t === 'add' ? t : null),
};
const input: InputMap<FakeState> = {
  idle: null,
  toAction: () => null,
  buttons: [{ id: 'add', label: 'Add', action: 'add' }],
  anchorFor: () => null,
  lessons: [
    { id: 'first', anchor: 'item-1', text: 'Tap first' },
    { id: 'second', anchor: 'add', text: 'Then add' },
    { id: 'third', anchor: 'item-1', text: 'Or switch' },
  ],
};
const proofs: ProofSet = { loadIndex: () => Promise.reject(new Error('none')), load: () => Promise.reject(new Error('none')) };

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  localStorage.clear();
});
afterEach(() => {
  document.body.innerHTML = '';
});

const hint = (root: HTMLElement): string | null => root.querySelector('[data-screen="play"] [data-hint]')?.textContent ?? null;
const click = (root: HTMLElement, id: string): void => root.querySelector<HTMLElement>(`[data-control="${id}"]`)?.click();

describe('the hint of the first level after Undo', () => {
  it('goes back with the state', () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, { def, theme: neutralTheme(), input, proofs, texts: { reasons: {} }, credits: ['x'] });
    click(root, 'levels');
    click(root, 'level-lv-1');
    expect(hint(root)).toBe('Tap first');
    click(root, 'add');
    expect(hint(root)).toBe('Then add');
    click(root, 'add');
    expect(hint(root)).toBe('Or switch');
    click(root, 'undo');
    expect(hint(root)).toBe('Then add');
    click(root, 'undo');
    expect(hint(root)).toBe('Tap first');
    click(root, 'add');
    expect(hint(root)).toBe('Then add');
    handle.destroy();
  });
});