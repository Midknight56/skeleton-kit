// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameDef } from '@kit/core';
import * as shell from './index';
import { mountGame } from './index';
import type { InputMap, ProofSet } from './index';
import { neutralTheme } from './test-theme';

type FakeState = { total: number };
const def: GameDef<FakeState, string> = {
  id: 'fake-game',
  title: 'Fake game',
  rulesVersion: '1',
  kind: 'turn',
  levels: () => [{ id: 'lv-1', title: 'One' }, { id: 'lv-2', title: 'Two' }],
  init: () => ({ total: 0 }),
  actions: (s) => (s.total >= 2 ? [] : ['add']),
  step: (s) => ({ total: s.total + 1 }),
  status: (s) => (s.total >= 2 ? { phase: 'won', score: s.total } : { phase: 'playing', score: s.total }),
  observe: (s) => ({ summary: `total ${s.total}`, facts: {} }),
  view: (_s, v) => ({ width: v.width, height: v.height, items: [{ kind: 'rect', id: 'item-1', layer: 'world', x: 0, y: 0, w: 40, h: 40, fill: '#336699' }] }),
  encodeAction: (a) => a,
  decodeAction: (t) => (t === 'add' ? t : null),
};

const input: InputMap<FakeState> = {
  idle: null,
  toAction: (e) => (e.type === 'pointer' && e.itemIds.includes('item-1') ? 'add' : null),
  buttons: [],
  anchorFor: () => null,
  lessons: [],
};

const proofs: ProofSet = {
  loadIndex: () => Promise.reject(new Error('none')),
  load: () => Promise.reject(new Error('none')),
};

const options = () => ({ def, theme: neutralTheme(), input, proofs, texts: { reasons: {} }, credits: ['Made for tests'] });

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  localStorage.clear();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('public surface', () => {
  it('exports mountGame, checkTheme, checkControls and itemIdsAt from one file', () => {
    expect(typeof shell.mountGame).toBe('function');
    expect(typeof shell.checkTheme).toBe('function');
    expect(typeof shell.checkControls).toBe('function');
    expect(typeof shell.itemIdsAt).toBe('function');
  });
});

describe('mountGame', () => {
  it('shows the title screen of the game inside the element', () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    const screen = root.querySelector<HTMLElement>('[data-screen]');
    expect(screen?.dataset.screen).toBe('title');
    expect(root.textContent).toContain('Fake game');
    handle.destroy();
  });

  it('throws an Error that names theme when there is no theme', () => {
    const root = document.getElementById('root')!;
    const bad = { ...options(), theme: undefined } as unknown as ReturnType<typeof options>;
    expect(() => mountGame(root, bad)).toThrowError(Error);
    expect(() => mountGame(root, bad)).toThrow(/theme/);
    expect(root.innerHTML).toBe('');
  });

  it('opens the level select and the play screen from the buttons', () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    root.querySelector<HTMLElement>('[data-control="levels"]')?.click();
    expect(root.querySelector<HTMLElement>('[data-screen]')?.dataset.screen).toBe('levels');
    root.querySelector<HTMLElement>('[data-control="level-lv-1"]')?.click();
    expect(root.querySelector<HTMLElement>('[data-screen]')?.dataset.screen).toBe('play');
    handle.destroy();
  });

  it('tells once on the title screen that progress will not be saved when storage is blocked', () => {
    const root = document.getElementById('root')!;
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });
    const handle = mountGame(root, options());
    expect(root.querySelector('[data-notice]')?.textContent).toBe('Progress will not be saved.');
    handle.destroy();
    vi.restoreAllMocks();
  });

  it('removes the DOM and every listener on destroy', () => {
    const root = document.getElementById('root')!;
    const added: [string, unknown][] = [];
    const removed: [string, unknown][] = [];
    const targets = [window, document];
    const spies = targets.flatMap((t) => [
      vi.spyOn(t, 'addEventListener').mockImplementation(((type: string, fn: unknown) => {
        added.push([type, fn]);
      }) as never),
      vi.spyOn(t, 'removeEventListener').mockImplementation(((type: string, fn: unknown) => {
        removed.push([type, fn]);
      }) as never),
    ]);
    const handle = mountGame(root, options());
    handle.destroy();
    spies.forEach((s) => s.mockRestore());
    expect(added.length).toBeGreaterThan(0);
    for (const [type, fn] of added) {
      expect(removed.some(([t, f]) => t === type && f === fn), `${type} listener removed`).toBe(true);
    }
    expect(root.innerHTML).toBe('');
  });
});
