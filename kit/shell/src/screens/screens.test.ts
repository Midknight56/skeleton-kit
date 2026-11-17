// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Viewport } from '@kit/core';
import { checkControls, playLayout, type ControlBox } from '../layout';
import { themeCss } from '../styles';
import { neutralTheme } from '../test-theme';
import { confirmBox } from './confirm';
import { creditsScreen } from './credits';
import { howScreen } from './how';
import { levelLocks, levelsScreen } from './levels';
import { pauseScreen } from './pause';
import { buttonWidth, playScreen } from './play-screen';
import { resultsScreen } from './results';
import { settingsScreen } from './settings';
import { titleScreen } from './title';

const controls = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLButtonElement>('[data-control]'));
const ids = (root: HTMLElement) => controls(root).map((b) => b.dataset.control);
const click = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-control="${id}"]`)?.click();
const noop = () => undefined;

describe('title screen', () => {
  const on = { play: noop, levels: noop, how: noop, settings: noop, credits: noop };

  it('has a data-screen root with the game title and one button for each way on', () => {
    const root = titleScreen(document, { title: 'Fake game', showNotice: false, on });
    expect(root.dataset.screen).toBe('title');
    expect(root.textContent).toContain('Fake game');
    expect(ids(root)).toEqual(['play', 'levels', 'how', 'settings', 'credits']);
  });

  it('shows the one time notice only when asked', () => {
    expect(titleScreen(document, { title: 'T', showNotice: true, on }).querySelector('[data-notice]')?.textContent).toBe('Progress will not be saved.');
    expect(titleScreen(document, { title: 'T', showNotice: false, on }).querySelector('[data-notice]')).toBeNull();
  });

  it('calls the handler of the button that was pressed', () => {
    const seen: string[] = [];
    const root = titleScreen(document, { title: 'T', showNotice: false, on: { ...on, play: () => seen.push('play'), levels: () => seen.push('levels') } });
    click(root, 'levels');
    click(root, 'play');
    expect(seen).toEqual(['levels', 'play']);
  });
});

describe('level select', () => {
  const levels = [
    { id: 'lv-1', title: 'One' },
    { id: 'lv-2', title: 'Two' },
    { id: 'lv-3', title: 'Three' },
    { id: 'lv-4', title: 'Four' },
  ];

  it('locks the levels after the first unfinished one', () => {
    expect(levelLocks(levels, (id) => id === 'lv-1')).toEqual([false, false, true, true]);
    expect(levelLocks(levels, () => false)).toEqual([false, true, true, true]);
    expect(levelLocks(levels, () => true)).toEqual([false, false, false, false]);
  });

  it('shows one tile for each level with its stars and its lock', () => {
    const stars: Record<string, number> = { 'lv-1': 3 };
    const root = levelsScreen(document, { levels, stars: (id) => stars[id] ?? 0, onPick: noop, onBack: noop });
    expect(root.dataset.screen).toBe('levels');
    const tiles = levels.map((l) => root.querySelector<HTMLElement>(`[data-control="level-${l.id}"]`)!);
    expect(tiles.map((t) => t.dataset.stars)).toEqual(['3', '0', '0', '0']);
    expect(tiles.map((t) => t.dataset.locked)).toEqual(['false', 'false', 'true', 'true']);
    expect(tiles[2]!.getAttribute('aria-disabled')).toBe('true');
    expect(tiles[0]!.getAttribute('aria-label')).toContain('3 of 3 stars');
  });

  it('opens an open tile and ignores a locked tile', () => {
    const picked: string[] = [];
    const root = levelsScreen(document, { levels, stars: () => 0, onPick: (id) => picked.push(id), onBack: noop });
    click(root, 'level-lv-3');
    click(root, 'level-lv-1');
    expect(picked).toEqual(['lv-1']);
  });

  it('has a back button', () => {
    let back = 0;
    const root = levelsScreen(document, { levels, stars: () => 0, onPick: noop, onBack: () => back++ });
    click(root, 'back');
    expect(back).toBe(1);
  });
});

describe('play strip', () => {
  it('puts the controls from 580 to 624 and the canvas 360 by 568 at 360 by 640', () => {
    const layout = playLayout(360, 640, { top: 0, right: 0, bottom: 0, left: 0 }, [44, 44, 60]);
    expect(layout.strip).toEqual({ x: 0, y: 568, w: 360, h: 72 });
    expect(layout.canvas).toEqual({ x: 0, y: 0, w: 360, h: 568 });
    expect(layout.controls).toEqual([
      { x: 16, y: 580, w: 44, h: 44 },
      { x: 72, y: 580, w: 44, h: 44 },
      { x: 128, y: 580, w: 60, h: 44 },
    ]);
  });

  it('adds the bottom safe inset to the strip', () => {
    const layout = playLayout(390, 844, { top: 0, right: 0, bottom: 34, left: 0 }, [44]);
    expect(layout.strip).toEqual({ x: 0, y: 844 - 72 - 34, w: 390, h: 72 + 34 });
    expect(layout.canvas.h).toBe(844 - 72 - 34);
    expect(layout.controls[0]).toEqual({ x: 16, y: 844 - 34 - 60, w: 44, h: 44 });
  });

  it('starts the first control 16 px inside a left safe inset', () => {
    const layout = playLayout(812, 375, { top: 0, right: 0, bottom: 0, left: 44 }, [44]);
    expect(layout.controls[0]?.x).toBe(60);
  });

  it('passes checkControls at the seven viewports for pause, undo and one wide button', () => {
    const sizes: [number, number][] = [[360, 640], [375, 667], [390, 844], [412, 915], [768, 1024], [1280, 720], [1920, 1080]];
    for (const [w, h] of sizes) {
      const viewport: Viewport = { width: w, height: h, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
      const layout = playLayout(w, h, viewport.safe, [44, 44, 64]);
      const boxes: ControlBox[] = layout.controls.map((c, i) => ({ screen: 'play', id: `c${i}`, ...c }));
      expect(checkControls(boxes, viewport, layout.canvas), `${w}x${h}`).toEqual([]);
    }
  });

  it('builds a play screen with the pause button, undo for a turn game and the buttons of the input map', () => {
    const view = playScreen(document, {
      width: 360,
      height: 640,
      safe: { top: 0, right: 0, bottom: 0, left: 0 },
      kind: 'turn',
      buttons: [{ id: 'wait', label: 'Wait', action: 'wait' }],
      on: { pause: noop, undo: noop, button: noop },
    });
    expect(view.root.dataset.screen).toBe('play');
    expect(ids(view.root)).toEqual(['pause', 'undo', 'wait']);
    const pause = view.root.querySelector<HTMLElement>('[data-control="pause"]')!;
    expect([pause.style.left, pause.style.top, pause.style.width, pause.style.height]).toEqual(['16px', '580px', '44px', '44px']);
    expect(view.canvas.style.height).toBe('568px');
  });

  it('has no undo button for a tick game', () => {
    const view = playScreen(document, {
      width: 360,
      height: 640,
      safe: { top: 0, right: 0, bottom: 0, left: 0 },
      kind: 'tick',
      buttons: [],
      on: { pause: noop, undo: noop, button: noop },
    });
    expect(ids(view.root)).toEqual(['pause']);
  });

  it('sends the action of a button and publishes the test attributes', () => {
    const seen: string[] = [];
    const view = playScreen(document, {
      width: 360,
      height: 640,
      safe: { top: 0, right: 0, bottom: 0, left: 0 },
      kind: 'turn',
      buttons: [{ id: 'wait', label: 'Wait', action: 'wait' }],
      on: { pause: noop, undo: () => seen.push('undo'), button: (a) => seen.push(a) },
    });
    click(view.root, 'wait');
    click(view.root, 'undo');
    expect(seen).toEqual(['wait', 'undo']);
    view.setStatus({ tick: 4, phase: 'playing', hash: 'abcd' });
    expect([view.root.dataset.tick, view.root.dataset.phase, view.root.dataset.hash]).toEqual(['4', 'playing', 'abcd']);
  });
});

describe('strip button width', () => {
  it('leaves 8 px each side of a label that is 0.6 em wide for each letter, at the font size of the theme', () => {
    // A real browser measured Wait and Back at about 0.6 em for each letter. The width keeps room beyond that.
    expect(buttonWidth('Wait', 18)).toBeGreaterThanOrEqual(16 + Math.ceil(4 * 18 * 0.6) + 4);
    expect(buttonWidth('Back', 16)).toBeGreaterThanOrEqual(16 + Math.ceil(4 * 16 * 0.6) + 4);
    expect(buttonWidth('Wait', 18)).toBeGreaterThan(buttonWidth('Wait', 14));
    expect(buttonWidth('', 16)).toBe(44);
  });
});

describe('pause screen', () => {
  it('has resume, retry and levels', () => {
    const root = pauseScreen(document, { onResume: noop, onRetry: noop, onLevels: noop });
    expect(root.dataset.screen).toBe('pause');
    expect(ids(root)).toEqual(['resume', 'retry', 'levels']);
  });
});

describe('results screen', () => {
  const on = { next: noop, retry: noop, levels: noop };

  it('shows the stars and the next button for a won level that is not the last', () => {
    const root = resultsScreen(document, { won: true, reason: undefined, reasons: {}, stars: 2, hasNext: true, on });
    expect(root.dataset.screen).toBe('results');
    expect(root.dataset.phase).toBe('won');
    expect(root.querySelector<HTMLElement>('[data-stars]')?.dataset.stars).toBe('2');
    expect(ids(root)).toEqual(['next', 'retry', 'levels']);
  });

  it('has no next button after the last level', () => {
    const root = resultsScreen(document, { won: true, reason: undefined, reasons: {}, stars: 3, hasNext: false, on });
    expect(ids(root)).toEqual(['retry', 'levels']);
  });

  it('shows the reason text of a lost level and no stars', () => {
    const root = resultsScreen(document, { won: false, reason: 'caught', reasons: { caught: 'Caught in a net' }, stars: 0, hasNext: true, on });
    expect(root.dataset.phase).toBe('lost');
    expect(root.querySelector('[data-reason]')?.textContent).toBe('Caught in a net');
    expect(root.querySelector('[data-stars]')).toBeNull();
    expect(ids(root)).toEqual(['retry', 'levels']);
  });

  it('shows the raw reason when the game gives no text for it', () => {
    const root = resultsScreen(document, { won: false, reason: 'odd', reasons: {}, stars: 0, hasNext: false, on });
    expect(root.querySelector('[data-reason]')?.textContent).toBe('odd');
  });

  it('calls the handler of each button', () => {
    const seen: string[] = [];
    const root = resultsScreen(document, {
      won: true,
      reason: undefined,
      reasons: {},
      stars: 1,
      hasNext: true,
      on: { next: () => seen.push('next'), retry: () => seen.push('retry'), levels: () => seen.push('levels') },
    });
    click(root, 'next');
    click(root, 'retry');
    click(root, 'levels');
    expect(seen).toEqual(['next', 'retry', 'levels']);
  });
});

describe('settings screen and the reset box', () => {
  function make(extra: { onReset?: () => void; onToggle?: (n: string, v: boolean) => void } = {}) {
    return settingsScreen(document, {
      settings: { sound: true, music: false },
      onToggle: extra.onToggle ?? noop,
      onReset: extra.onReset ?? noop,
      onBack: noop,
    });
  }

  it('has a switch for sound, a switch for music, reset and back', () => {
    const root = make();
    expect(root.dataset.screen).toBe('settings');
    expect(ids(root)).toEqual(['sound', 'music', 'reset', 'back']);
    expect(root.querySelector('[data-control="sound"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('[data-control="music"]')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('flips a switch and reports the new value', () => {
    const seen: string[] = [];
    const root = make({ onToggle: (n, v) => seen.push(`${n}:${v}`) });
    click(root, 'sound');
    click(root, 'music');
    expect(seen).toEqual(['sound:false', 'music:true']);
    expect(root.querySelector('[data-control="sound"]')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('asks before it resets and deletes nothing on cancel', () => {
    let resets = 0;
    const root = make({ onReset: () => resets++ });
    click(root, 'reset');
    expect(resets).toBe(0);
    expect(root.querySelector('[data-dialog="confirm"]')).not.toBeNull();
    click(root, 'cancel');
    expect(root.querySelector('[data-dialog="confirm"]')).toBeNull();
    expect(resets).toBe(0);
  });

  it('resets once on confirm and closes the box', () => {
    let resets = 0;
    const root = make({ onReset: () => resets++ });
    click(root, 'reset');
    click(root, 'confirm');
    expect(resets).toBe(1);
    expect(root.querySelector('[data-dialog="confirm"]')).toBeNull();
  });

  it('builds a confirm box with two buttons and a dialog role', () => {
    const box = confirmBox(document, { message: 'Sure?', confirmLabel: 'Yes', cancelLabel: 'No', onConfirm: noop, onCancel: noop });
    expect(box.getAttribute('role')).toBe('dialog');
    expect(ids(box)).toEqual(['confirm', 'cancel']);
  });
});

describe('how to play and credits', () => {
  it('lists the lessons and the keys', () => {
    const root = howScreen(document, {
      lessons: [{ id: 'l-1', anchor: 'item-1', text: 'Tap here' }],
      keys: ['1: first', 'Space: wait'],
      onBack: noop,
    });
    expect(root.dataset.screen).toBe('how');
    expect(root.textContent).toContain('Tap here');
    expect(root.textContent).toContain('Space: wait');
    expect(ids(root)).toEqual(['back']);
  });

  it('shows each credit line and a back button', () => {
    let back = 0;
    const root = creditsScreen(document, { lines: ['Made by A', 'Music by B'], onBack: () => back++ });
    expect(root.dataset.screen).toBe('credits');
    expect(root.textContent).toContain('Made by A');
    expect(root.textContent).toContain('Music by B');
    click(root, 'back');
    expect(back).toBe(1);
  });
});

describe('theme css', () => {
  it('has a visible focus mark, the button radius and the palette', () => {
    const css = themeCss(neutralTheme());
    expect(css).toContain(':focus-visible');
    expect(css).toContain('border-radius: 8px');
    expect(css).toContain('#101830');
    expect(css).not.toMatch(/https?:|url\(/);
  });
});
