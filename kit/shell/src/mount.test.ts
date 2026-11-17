// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession, type GameDef, type Replay } from '@kit/core';
import * as shell from './index';
import { mountGame } from './index';
import type { InputMap, ProofFile, ProofSet } from './index';
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

  it('removes the loading screen of the page and sets the page title to the game title', () => {
    document.body.innerHTML = '<div data-screen="loading"><h1>Fake game</h1></div><div id="root"></div>';
    document.title = 'Loading';
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    expect(document.querySelector('[data-screen="loading"]')).toBeNull();
    expect(root.querySelector<HTMLElement>('[data-screen]')?.dataset.screen).toBe('title');
    expect(document.title).toBe('Fake game');
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

  it('keeps the notice on the title screen when the proof index loads after the first paint, and drops it on the next visit', async () => {
    const root = document.getElementById('root')!;
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });
    const slow: ProofSet = {
      loadIndex: () => Promise.resolve({ game: 'fake-game', levels: [{ id: 'lv-1', actions: 2 }] }),
      load: () => Promise.reject(new Error('none')),
    };
    const handle = mountGame(root, { ...options(), proofs: slow });
    expect(root.querySelector('[data-notice]')).not.toBeNull();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.querySelector('[data-control="watch"]'), 'the title was drawn again').not.toBeNull();
    expect(root.querySelector('[data-notice]')?.textContent).toBe('Progress will not be saved.');
    root.querySelector<HTMLElement>('[data-control="credits"]')?.click();
    root.querySelector<HTMLElement>('[data-control="back"]')?.click();
    expect(root.querySelector('[data-notice]')).toBeNull();
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

// The usage events, read from a fake sendBeacon. The beacon url comes from the build variable, so the
// tests set it with vi.stubEnv. Animation frames run by hand, so a watch run can be moved to its end.
describe('usage events from mountGame', () => {
  interface Event { event: string; level?: string; result?: string }
  let blobs: Blob[] = [];
  let frames: FrameRequestCallback[] = [];
  let now = 0;
  const realRaf = window.requestAnimationFrame;
  const realCancel = window.cancelAnimationFrame;

  const readBlob = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
  const events = async (): Promise<Event[]> => Promise.all(blobs.map(async (b) => JSON.parse(await readBlob(b)) as Event));
  const names = async () => (await events()).map((e) => (e.result ? `${e.event}:${e.result}` : e.event));

  // Runs n animation frames of dt ms each.
  function runFrames(n: number, dt = 100): void {
    for (let i = 0; i < n; i++) {
      const due = frames;
      frames = [];
      now += dt;
      for (const cb of due) cb(now);
    }
  }

  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const popped = () => new Promise<void>((resolve) => window.addEventListener('popstate', () => setTimeout(resolve, 0), { once: true }));
  const screenOf = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-screen]')?.dataset.screen;
  const press = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-control="${id}"]`)?.click();
  // One tap on item-1 adds one to the total. Two taps win.
  const tap = (root: HTMLElement) => root.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }));

  function proofFile(): ProofFile {
    const session = createSession(def, 'lv-1', 1);
    session.apply('add');
    session.apply('add');
    const replay: Replay = { format: 1, game: def.id, rulesVersion: def.rulesVersion, level: 'lv-1', seed: 1, actions: ['add', 'add'], finalHash: session.hash(), finalPhase: 'won' };
    return { format: 1, game: def.id, kind: 'turn', level: 'lv-1', rulesVersion: '1', seed: 1, checks: [{ name: 'ok', passed: true, detail: '' }], replay, stats: { actions: 2, nodes: 3 } };
  }
  const withProof: ProofSet = {
    loadIndex: () => Promise.resolve({ game: 'fake-game', levels: [{ id: 'lv-1', actions: 2 }] }),
    load: () => Promise.resolve(proofFile()),
  };

  beforeEach(() => {
    blobs = [];
    frames = [];
    now = 0;
    vi.stubEnv('VITE_BEACON_URL', 'https://beacon.invalid/e');
    Object.defineProperty(window.navigator, 'sendBeacon', {
      configurable: true,
      value: (_url: string, data: Blob) => {
        blobs.push(data);
        return true;
      },
    });
    window.requestAnimationFrame = (cb) => frames.push(cb);
    window.cancelAnimationFrame = () => {
      frames = [];
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window.navigator as unknown as Record<string, unknown>).sendBeacon;
    window.requestAnimationFrame = realRaf;
    window.cancelAnimationFrame = realCancel;
    vi.useRealTimers();
  });

  async function startLevel(root: HTMLElement) {
    press(root, 'levels');
    press(root, 'level-lv-1');
    expect(screenOf(root)).toBe('play');
  }

  it('sends level_end won once when the level is won', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    await startLevel(root);
    tap(root);
    tap(root);
    expect(await names()).toEqual(['open', 'level_start', 'level_end:won']);
    expect((await events())[2]).toEqual({ game: 'fake-game', event: 'level_end', level: 'lv-1', result: 'won' });
    handle.destroy();
  });

  it('sends level_end left when Retry on the pause screen is confirmed, then a new level_start', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    await startLevel(root);
    press(root, 'pause');
    press(root, 'retry');
    expect(await names(), 'nothing is sent before the player confirms').toEqual(['open', 'level_start']);
    press(root, 'confirm');
    expect(screenOf(root)).toBe('play');
    expect(await names()).toEqual(['open', 'level_start', 'level_end:left', 'level_start']);
    expect((await events())[2]).toEqual({ game: 'fake-game', event: 'level_end', level: 'lv-1', result: 'left' });
    handle.destroy();
  });

  it('sends level_end left when Levels on the pause screen is confirmed', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    await startLevel(root);
    press(root, 'pause');
    press(root, 'levels');
    press(root, 'confirm');
    expect(screenOf(root)).toBe('levels');
    expect(await names()).toEqual(['open', 'level_start', 'level_end:left']);
    handle.destroy();
  });

  it('sends no level_end when the player stays, or pauses and resumes', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    await startLevel(root);
    press(root, 'pause');
    press(root, 'retry');
    press(root, 'cancel');
    press(root, 'resume');
    window.dispatchEvent(new Event('blur'));
    expect(screenOf(root)).toBe('pause');
    press(root, 'resume');
    expect(screenOf(root)).toBe('play');
    expect(await names()).toEqual(['open', 'level_start']);
    handle.destroy();
  });

  it('sends level_end left when the browser back button leaves the play screen', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    await startLevel(root);
    const back = popped();
    window.history.back();
    await back;
    expect(screenOf(root)).toBe('levels');
    expect(await names()).toEqual(['open', 'level_start', 'level_end:left']);
    handle.destroy();
  });

  it('sends level_end left when the browser back button leaves the pause screen', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    await startLevel(root);
    press(root, 'pause');
    const back = popped();
    window.history.back();
    await back;
    expect(screenOf(root)).toBe('play');
    const back2 = popped();
    window.history.back();
    await back2;
    expect(screenOf(root)).toBe('levels');
    // Back from pause lands on the fresh play entry, which starts the level again.
    expect(await names()).toEqual(['open', 'level_start', 'level_end:left', 'level_start', 'level_end:left']);
    handle.destroy();
  });

  it('sends no left after a won level, when the results screen is left', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    await startLevel(root);
    tap(root);
    tap(root);
    vi.advanceTimersByTime(500);
    expect(screenOf(root)).toBe('results');
    press(root, 'levels');
    expect(await names()).toEqual(['open', 'level_start', 'level_end:won']);
    handle.destroy();
  });

  it('only one level_end per level_start, over a long mixed visit', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    await startLevel(root);
    // Leave by Retry, win, retry from results, pause and leave by Levels, start again and lose focus.
    press(root, 'pause');
    press(root, 'retry');
    press(root, 'confirm');
    tap(root);
    tap(root);
    vi.advanceTimersByTime(500);
    press(root, 'retry');
    press(root, 'pause');
    press(root, 'levels');
    press(root, 'confirm');
    press(root, 'level-lv-1');
    window.dispatchEvent(new Event('blur'));
    press(root, 'resume');
    press(root, 'pause');
    press(root, 'retry');
    press(root, 'confirm');
    press(root, 'pause');
    press(root, 'levels');
    press(root, 'confirm');
    const seen = (await events()).filter((e) => e.event === 'level_start' || e.event === 'level_end');
    // Each level_start is followed by exactly one level_end before the next level_start.
    let open = false;
    for (const e of seen) {
      if (e.event === 'level_start') {
        expect(open, 'a level_start while a level is still open').toBe(false);
        open = true;
      } else {
        expect(open, 'a level_end with no open level').toBe(true);
        open = false;
      }
    }
    expect(open).toBe(false);
    expect(seen.map((e) => e.result ?? 'start')).toEqual(['start', 'left', 'start', 'won', 'start', 'left', 'start', 'left', 'start', 'left']);
    handle.destroy();
  });

  it('sends watch_end once when the watch replay reaches its end, and not again when it loops or is left', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, { ...options(), proofs: withProof, search: '?watch=lv-1' });
    await tick();
    await tick();
    expect(screenOf(root)).toBe('watch');
    expect(await names()).toEqual(['open', 'watch_start']);
    runFrames(30);
    expect(await names()).toEqual(['open', 'watch_start', 'watch_end']);
    expect((await events())[2]).toEqual({ game: 'fake-game', event: 'watch_end', level: 'lv-1' });
    // The run starts again after 3 s and ends again: still one watch_end.
    runFrames(80);
    press(root, 'back');
    expect(screenOf(root)).toBe('title');
    expect(await names()).toEqual(['open', 'watch_start', 'watch_end']);
    handle.destroy();
  });

  it('sends watch_end once when the player leaves the watch screen before the end', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, { ...options(), proofs: withProof, search: '?watch=lv-1' });
    await tick();
    await tick();
    runFrames(2);
    press(root, 'back');
    expect(screenOf(root)).toBe('title');
    runFrames(30);
    expect(await names()).toEqual(['open', 'watch_start', 'watch_end']);
    handle.destroy();
  });

  it('sends watch_end once when the browser back button leaves the watch screen', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, { ...options(), proofs: withProof });
    await tick();
    await tick();
    press(root, 'watch');
    await tick();
    await tick();
    expect(screenOf(root)).toBe('watch');
    const back = popped();
    window.history.back();
    await back;
    expect(screenOf(root)).toBe('title');
    expect(await names()).toEqual(['open', 'watch_start', 'watch_end']);
    handle.destroy();
  });

  it('sends nothing at all when usage data is off in the saved settings', async () => {
    localStorage.setItem('kit.fake-game.v1', JSON.stringify({ version: 1, levels: {}, settings: { sound: true, music: true, usage: false }, lessons: {} }));
    const root = document.getElementById('root')!;
    const handle = mountGame(root, options());
    await startLevel(root);
    tap(root);
    tap(root);
    expect(blobs).toEqual([]);
    handle.destroy();
  });

  it('stops sending at once when usage data is turned off in the settings, and keeps it off after a reload', async () => {
    const root = document.getElementById('root')!;
    let handle = mountGame(root, options());
    press(root, 'settings');
    const usage = root.querySelector<HTMLElement>('[data-control="usage"]')!;
    expect(usage.getAttribute('aria-pressed')).toBe('true');
    press(root, 'usage');
    expect(usage.getAttribute('aria-pressed')).toBe('false');
    press(root, 'back');
    await startLevel(root);
    expect(await names()).toEqual(['open']);
    handle.destroy();
    document.body.innerHTML = '<div id="root"></div>';
    const again = document.getElementById('root')!;
    handle = mountGame(again, options());
    press(again, 'settings');
    expect(again.querySelector('[data-control="usage"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(await names()).toEqual(['open']);
    handle.destroy();
  });
});
