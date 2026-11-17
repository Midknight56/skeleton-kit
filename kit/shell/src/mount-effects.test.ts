// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession, type GameDef, type Replay } from '@kit/core';
import { mountGame } from './index';
import type { EffectLayer, InputMap, ProofFile, ProofSet } from './index';
import { neutralTheme } from './test-theme';

type FakeState = { total: number };
const def: GameDef<FakeState, string> = {
  id: 'fake-game',
  title: 'Fake game',
  rulesVersion: '1',
  kind: 'turn',
  levels: () => [{ id: 'lv-1', title: 'One' }],
  init: () => ({ total: 0 }),
  actions: (s) => (s.total >= 2 ? [] : ['add']),
  step: (s) => ({ total: s.total + 1 }),
  status: (s) => (s.total >= 2 ? { phase: 'won', score: s.total } : { phase: 'playing', score: s.total }),
  observe: (s) => ({ summary: `total ${s.total}`, facts: {} }),
  view: (s, v) => ({ width: v.width, height: v.height, items: [{ kind: 'rect', id: 'item-1', layer: 'world', x: s.total, y: 0, w: 40, h: 40, fill: '#336699' }] }),
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

function proofFile(): ProofFile {
  const session = createSession(def, 'lv-1', 1);
  session.apply('add');
  session.apply('add');
  const replay: Replay = { format: 1, game: def.id, rulesVersion: def.rulesVersion, level: 'lv-1', seed: 1, actions: ['add', 'add'], finalHash: session.hash(), finalPhase: 'won' };
  return { format: 1, game: def.id, kind: 'turn', level: 'lv-1', rulesVersion: '1', seed: 1, checks: [{ name: 'ok', passed: true, detail: '' }], replay, stats: { actions: 2, nodes: 3 } };
}
const proofs: ProofSet = {
  loadIndex: () => Promise.resolve({ game: 'fake-game', levels: [{ id: 'lv-1', actions: 2 }] }),
  load: () => Promise.resolve(proofFile()),
};

interface FakeLayer extends EffectLayer { changes: number; resets: number; made: number }
let layers: FakeLayer[] = [];
function factory(hold?: { won: number; lost: number }): () => EffectLayer {
  return () => {
    const layer: FakeLayer = {
      changes: 0,
      resets: 0,
      made: layers.length + 1,
      change() {
        layer.changes += 1;
      },
      reset() {
        layer.resets += 1;
      },
      owns: () => false,
      pose: () => null,
      paint() {},
      counts: () => ({ mote: 2 }),
      ...(hold ? { hold } : {}),
    };
    layers.push(layer);
    return layer;
  };
}

const options = (effects?: () => EffectLayer) => ({ def, theme: neutralTheme(), input, proofs, texts: { reasons: {} }, credits: ['Made for tests'], ...(effects ? { effects } : {}) });

let frames: FrameRequestCallback[] = [];
let now = 0;
const realRaf = window.requestAnimationFrame;
const realCancel = window.cancelAnimationFrame;

function runFrames(n: number, dt = 100): void {
  for (let i = 0; i < n; i++) {
    const due = frames;
    frames = [];
    now += dt;
    for (const cb of due) cb(now);
  }
}

function fakeContext(): CanvasRenderingContext2D {
  const store: Record<string, unknown> = {};
  return new Proxy(store, { get: (t, k: string) => (k in t ? t[k] : () => undefined), set: (t, k: string, v) => ((t[k] = v), true) }) as unknown as CanvasRenderingContext2D;
}

function reduceMotion(on: boolean): void {
  window.matchMedia = ((query: string) => ({ matches: on && query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}

const press = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-control="${id}"]`)?.click();
const screenOf = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-screen]')?.dataset.screen;
const tap = (root: HTMLElement) => root.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }));

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  HTMLCanvasElement.prototype.getContext = (() => fakeContext()) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  localStorage.clear();
  layers = [];
  frames = [];
  now = 0;
  reduceMotion(false);
  window.requestAnimationFrame = (cb) => frames.push(cb);
  window.cancelAnimationFrame = () => {
    frames = [];
  };
});

afterEach(() => {
  document.body.innerHTML = '';
  window.requestAnimationFrame = realRaf;
  window.cancelAnimationFrame = realCancel;
  vi.useRealTimers();
});

describe('mountGame with effects', () => {
  it('makes one layer for each play screen and feeds it the scenes', () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options(factory()));
    press(root, 'levels');
    press(root, 'level-lv-1');
    runFrames(2);
    expect(layers).toHaveLength(1);
    expect(layers[0]?.changes).toBeGreaterThanOrEqual(1);
    tap(root);
    runFrames(2);
    expect(layers[0]?.changes).toBeGreaterThanOrEqual(2);
    expect(root.querySelector('canvas')?.dataset.effects).toBe('2');
    handle.destroy();
  });

  it('shows no data-effects on a game that has no effects', () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    press(root, 'levels');
    press(root, 'level-lv-1');
    runFrames(2);
    expect(root.querySelector('canvas')?.dataset.effects).toBeUndefined();
    handle.destroy();
  });

  it('keeps the play screen for the hold of the layer before the results screen', () => {
    vi.useFakeTimers();
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options(factory({ won: 700, lost: 300 })));
    press(root, 'levels');
    press(root, 'level-lv-1');
    runFrames(1);
    tap(root);
    tap(root);
    vi.advanceTimersByTime(400);
    expect(screenOf(root)).toBe('play');
    vi.advanceTimersByTime(400);
    expect(screenOf(root)).toBe('results');
    handle.destroy();
  });

  it('opens the results screen at once when reduced motion is on', () => {
    vi.useFakeTimers();
    reduceMotion(true);
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options(factory({ won: 700, lost: 300 })));
    press(root, 'levels');
    press(root, 'level-lv-1');
    runFrames(1);
    tap(root);
    tap(root);
    vi.advanceTimersByTime(10);
    expect(screenOf(root)).toBe('results');
    handle.destroy();
  });

  it('opens the results screen after the old delay when the game has no effects', () => {
    vi.useFakeTimers();
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    press(root, 'levels');
    press(root, 'level-lv-1');
    runFrames(1);
    tap(root);
    tap(root);
    vi.advanceTimersByTime(130);
    expect(screenOf(root)).toBe('results');
    handle.destroy();
  });

  it('resets the layer when a watch run starts again', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options(factory()));
    await new Promise((resolve) => setTimeout(resolve, 0));
    press(root, 'watch');
    await new Promise((resolve) => setTimeout(resolve, 0));
    runFrames(200, 100);
    expect(layers.length).toBe(1);
    expect(layers[0]?.resets).toBeGreaterThanOrEqual(1);
    handle.destroy();
  });
});

describe('the lift of a screen that leaves', () => {
  it('leaves a hollow ghost of a menu card that rises for 300 ms and has no text and no control', () => {
    vi.useFakeTimers();
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    press(root, 'levels');
    expect(root.querySelector('[data-lift]')).toBeNull();
    press(root, 'back');
    const ghost = root.querySelector<HTMLElement>('[data-lift]');
    expect(ghost).not.toBeNull();
    expect(ghost?.textContent).toBe('');
    expect(ghost?.querySelector('[data-control], [data-screen], button, h1')).toBeNull();
    expect(ghost?.getAttribute('aria-hidden')).toBe('true');
    vi.advanceTimersByTime(320);
    expect(root.querySelector('[data-lift]')).toBeNull();
    handle.destroy();
  });

  it('leaves no ghost when reduced motion is on', () => {
    reduceMotion(true);
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    press(root, 'levels');
    press(root, 'back');
    expect(root.querySelector('[data-lift]')).toBeNull();
    handle.destroy();
  });
});
