// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameDef } from '@kit/core';
import { mountGame } from './index';
import type { InputMap, ProofSet } from './index';
import { neutralTheme } from './test-theme';

// A key that does nothing in this state gives the same reason as the button of that action.

type FakeState = { ready: boolean; total: number };
const def: GameDef<FakeState, string> = {
  id: 'fake-keys',
  title: 'Fake keys',
  rulesVersion: '1',
  kind: 'turn',
  levels: () => [{ id: 'lv-1', title: 'One' }],
  init: () => ({ ready: false, total: 0 }),
  actions: (s) => (s.total >= 3 ? [] : s.ready ? ['go', 'ready'] : ['ready']),
  step: (s, a) => (a === 'ready' ? { ...s, ready: true } : { ...s, total: s.total + 1 }),
  status: (s) => (s.total >= 3 ? { phase: 'won', score: s.total } : { phase: 'playing', score: s.total }),
  observe: (s) => ({ summary: `total ${s.total}`, facts: {} }),
  view: (_s, v) => ({ width: v.width, height: v.height, items: [{ kind: 'rect', id: 'item-1', layer: 'world', x: 0, y: 0, w: 40, h: 40, fill: '#336699' }] }),
  encodeAction: (a) => a,
  decodeAction: (t) => (t === 'go' || t === 'ready' ? t : null),
};

const REASON = 'Get ready first';
const input: InputMap<FakeState> = {
  idle: null,
  toAction: (e, s) => (e.type === 'key' && e.key === ' ' && s.ready ? 'go' : e.type === 'key' && e.key === 'r' ? 'ready' : null),
  buttons: [{ id: 'go', label: 'Go', action: 'go' }],
  anchorFor: () => null,
  lessons: [],
  refused: (action, s) => (action === 'go' && !s.ready ? REASON : null),
  refusedKey: (key, s) => (key === ' ' && !s.ready ? { anchor: 'go', text: REASON } : null),
};

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

function play(): { root: HTMLElement; destroy(): void } {
  const root = document.getElementById('root')!;
  const handle = mountGame(root, { def, theme: neutralTheme(), input, proofs, texts: { reasons: {} }, credits: ['Made for tests'] });
  root.querySelector<HTMLElement>('[data-control="level-lv-1"]')?.click();
  if (!root.querySelector('[data-screen="play"]')) {
    root.querySelector<HTMLElement>('[data-control="levels"]')?.click();
    root.querySelector<HTMLElement>('[data-control="level-lv-1"]')?.click();
  }
  return { root, destroy: () => handle.destroy() };
}
const press = (key: string): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
};
const hint = (root: HTMLElement): string | null => root.querySelector('[data-hint="refused"]')?.textContent ?? null;

describe('a key that the rules cannot use now', () => {
  it('shows the reason of the game beside its button, as the button does', () => {
    const { root, destroy } = play();
    expect(root.querySelector('[data-screen="play"]')).not.toBeNull();
    root.querySelector<HTMLElement>('[data-control="go"]')?.click();
    const fromButton = hint(root);
    expect(fromButton).toBe(REASON);
    root.querySelector('[data-hint="refused"]')?.remove();
    press(' ');
    expect(hint(root)).toBe(fromButton);
    destroy();
  });

  it('shows nothing for a key that the game does not know', () => {
    const { root, destroy } = play();
    press('z');
    expect(hint(root)).toBeNull();
    destroy();
  });

  it('shows nothing when the key works', () => {
    const { root, destroy } = play();
    press('r');
    press(' ');
    expect(hint(root)).toBeNull();
    destroy();
  });
});
