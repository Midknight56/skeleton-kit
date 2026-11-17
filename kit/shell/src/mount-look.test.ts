// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession, type GameDef, type Replay } from '@kit/core';
import { mountGame } from './index';
import type { InputMap, ProofFile, ProofSet } from './index';
import { neutralTheme } from './test-theme';
import { WATCH_MESSAGE } from './watch-message';

type FakeState = { total: number };
const def: GameDef<FakeState, string> = {
  id: 'fake-look',
  title: 'Fake look',
  rulesVersion: '1',
  kind: 'turn',
  levels: () => [{ id: 'lv-1', title: 'One' }, { id: 'lv-2', title: 'Two' }, { id: 'lv-3', title: 'Three' }],
  init: () => ({ total: 0 }),
  actions: (s) => (s.total >= 2 ? [] : ['add']),
  step: (s) => ({ total: s.total + 1 }),
  status: (s) => (s.total >= 2 ? { phase: 'won', score: s.total } : { phase: 'playing', score: s.total }),
  observe: (s) => ({ summary: `total ${s.total}`, facts: {} }),
  view: (_s, v) => ({ width: v.width, height: v.height, items: [{ kind: 'rect', id: 'item-1', layer: 'world', x: 0, y: 0, w: 40, h: 40, fill: '#336699' }] }),
  encodeAction: (a) => a,
  decodeAction: (t) => (t === 'add' ? t : null),
};

const input: InputMap<FakeState> = { idle: null, toAction: () => null, buttons: [], anchorFor: () => null, lessons: [] };
const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 50">${inner}</svg>`;

function proofFile(): ProofFile {
  const session = createSession(def, 'lv-1', 1);
  session.apply('add');
  session.apply('add');
  const replay: Replay = { format: 1, game: def.id, rulesVersion: def.rulesVersion, level: 'lv-1', seed: 1, actions: ['add', 'add'], finalHash: session.hash(), finalPhase: 'won' };
  return { format: 1, game: def.id, kind: 'turn', level: 'lv-1', rulesVersion: '1', seed: 1, checks: [{ name: 'ok', passed: true, detail: '' }], replay, stats: { actions: 2, nodes: 3 } };
}
const proofs: ProofSet = {
  loadIndex: () => Promise.resolve({ game: def.id, levels: [{ id: 'lv-1', actions: 2 }] }),
  load: () => Promise.resolve(proofFile()),
};

const theme = () => ({ ...neutralTheme(), titleArt: { wide: svg(''), narrow: svg('') }, garland: { lit: svg('<g data-x="lit"/>'), unlit: svg('<g data-x="unlit"/>') } });
const options = () => ({ def, theme: theme(), input, proofs, texts: { reasons: {} }, credits: ['Made for tests'], tagline: 'A line.' });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const lookOf = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-backdrop]')?.dataset.look;

let frames: FrameRequestCallback[] = [];
let now = 0;
const realRaf = window.requestAnimationFrame;
const realCancel = window.cancelAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  localStorage.clear();
  frames = [];
  now = 0;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => frames.push(cb)) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = (() => undefined) as typeof window.cancelAnimationFrame;
});

afterEach(() => {
  window.requestAnimationFrame = realRaf;
  window.cancelAnimationFrame = realCancel;
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function runFrames(n: number, dt = 100): void {
  for (let i = 0; i < n; i++) {
    const due = frames;
    frames = [];
    now += dt;
    for (const cb of due) cb(now);
  }
}

describe('mountGame look', () => {
  it('keeps one sky and one rail through every screen, and sets the look of each', () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    expect(root.querySelectorAll('[data-backdrop]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-rail]')).toHaveLength(1);
    expect(lookOf(root)).toBe('title');
    root.querySelector<HTMLElement>('[data-control="levels"]')?.click();
    expect(root.querySelectorAll('[data-backdrop]')).toHaveLength(1);
    expect(lookOf(root)).toBe('menu');
    root.querySelector<HTMLElement>('[data-control="back"]')?.click();
    root.querySelector<HTMLElement>('[data-control="play"]')?.click();
    expect(root.querySelector('[data-screen]')?.getAttribute('data-screen')).toBe('play');
    expect(lookOf(root)).toBe('play');
    expect(root.querySelectorAll('[data-rail]')).toHaveLength(1);
    handle.destroy();
  });

  it('shows the tagline and a garland that follows the finished levels', () => {
    const root = document.getElementById('root')!;
    localStorage.setItem('kit.fake-look.v1', JSON.stringify({ version: 1, levels: { 'lv-1': { stars: 3, best: 2 } }, settings: { sound: true, music: true, usage: true }, lessons: {} }));
    const handle = mountGame(root, options());
    expect(root.querySelector('[data-tagline]')?.textContent).toBe('A line.');
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-garland-item]'));
    expect(items.map((i) => i.dataset.lit)).toEqual(['true', 'false', 'false']);
    handle.destroy();
  });
});

describe('watch screen messages to the page that holds it', () => {
  it('posts how far the run is, to the same origin, each time the run moves', async () => {
    const root = document.getElementById('root')!;
    const posted: { message: unknown; origin: string }[] = [];
    const parent = { postMessage: (message: unknown, origin: string) => posted.push({ message, origin }) };
    vi.spyOn(window, 'parent', 'get').mockReturnValue(parent as unknown as Window);
    const handle = mountGame(root, { ...options(), search: '?watch=lv-1' });
    await tick();
    await tick();
    runFrames(30);
    const applied = posted.map((p) => (p.message as { applied: number }).applied);
    expect(applied[0]).toBe(0);
    expect(applied).toContain(1);
    expect(applied).toContain(2);
    for (const p of posted) {
      expect(p.origin).toBe(window.location.origin);
      expect(p.message).toMatchObject({ type: WATCH_MESSAGE, level: 'lv-1', total: 2 });
    }
    handle.destroy();
  });

  it('posts nothing when the page is not in a frame', async () => {
    const root = document.getElementById('root')!;
    const spy = vi.spyOn(window, 'postMessage');
    const handle = mountGame(root, { ...options(), search: '?watch=lv-1' });
    await tick();
    await tick();
    runFrames(30);
    expect(spy).not.toHaveBeenCalled();
    handle.destroy();
  });
});
