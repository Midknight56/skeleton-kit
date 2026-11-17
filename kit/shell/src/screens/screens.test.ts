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
import { watchLayout, watchScreen } from './watch-screen';
import { hudTextBoxes } from '../painter';

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

  it('at scale 2 makes the buttons 88 px high, the labels twice as big, and keeps 16 px, 8 px and 12 px', () => {
    const view = playScreen(document, {
      width: 1920,
      height: 1080,
      safe: { top: 0, right: 0, bottom: 0, left: 0 },
      kind: 'turn',
      buttons: [{ id: 'wait', label: 'Wait', action: 'wait' }],
      fontSize: 18,
      scale: 2,
      on: { pause: noop, undo: noop, button: noop },
    });
    const box = (id: string) => view.root.querySelector<HTMLElement>(`[data-control="${id}"]`)!;
    const wait = box('wait');
    expect(wait.style.height).toBe('88px');
    expect(wait.style.top).toBe(`${1080 - 16 - 88}px`);
    expect(wait.style.fontSize).toBe('36px');
    expect(wait.style.padding).toBe('0px 8px');
    expect(box('pause').style.width).toBe('88px');
    expect(parseFloat(box('undo').style.left) - (parseFloat(box('pause').style.left) + 88)).toBe(12);
    expect(parseFloat(wait.style.width)).toBeGreaterThanOrEqual(buttonWidth('Wait', 36));
    expect(view.canvas.style.height).toBe(`${1080 - 28 - 88}px`);
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

  function make() {
    const seen: string[] = [];
    const root = pauseScreen(document, { onResume: () => seen.push('resume'), onRetry: () => seen.push('retry'), onLevels: () => seen.push('levels') });
    document.body.append(root);
    return { root, seen };
  }
  const dialog = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-dialog="confirm"]');
  const labels = (root: HTMLElement) => Array.from(dialog(root)!.querySelectorAll('[data-control]')).map((b) => `${(b as HTMLElement).dataset.control}:${b.textContent}`);

  it('resumes at once, with no question', () => {
    const { root, seen } = make();
    click(root, 'resume');
    expect(seen).toEqual(['resume']);
    expect(dialog(root)).toBeNull();
    root.remove();
  });

  it.each(['retry', 'levels'])('asks Leave this run? before %s and does nothing yet', (id) => {
    const { root, seen } = make();
    click(root, id);
    expect(seen).toEqual([]);
    expect(dialog(root)?.textContent).toContain('Leave this run?');
    expect(labels(root)).toEqual(['confirm:Leave', 'cancel:Stay']);
    root.remove();
  });

  it('starts with the focus on Stay', () => {
    const { root } = make();
    click(root, 'retry');
    expect((document.activeElement as HTMLElement).dataset.control).toBe('cancel');
    expect(document.activeElement?.textContent).toBe('Stay');
    root.remove();
  });

  it.each([
    ['retry', 'retry'],
    ['levels', 'levels'],
  ])('runs %s once on Leave and closes the box', (id, expected) => {
    const { root, seen } = make();
    click(root, id);
    click(root, 'confirm');
    expect(seen).toEqual([expected]);
    expect(dialog(root)).toBeNull();
    root.remove();
  });

  it('keeps the run on Stay and gives the focus back to the button that asked', () => {
    const { root, seen } = make();
    click(root, 'levels');
    click(root, 'cancel');
    expect(seen).toEqual([]);
    expect(dialog(root)).toBeNull();
    expect((document.activeElement as HTMLElement).dataset.control).toBe('levels');
    root.remove();
  });

  it('treats Escape as Stay', () => {
    const { root, seen } = make();
    click(root, 'retry');
    (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(seen).toEqual([]);
    expect(dialog(root)).toBeNull();
    root.remove();
  });

  it('opens one box at a time', () => {
    const { root } = make();
    click(root, 'retry');
    click(root, 'levels');
    expect(root.querySelectorAll('[data-dialog="confirm"]').length).toBe(1);
    root.remove();
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
  function make(extra: { onReset?: () => void; onToggle?: (n: string, v: boolean) => void; usage?: boolean } = {}) {
    return settingsScreen(document, {
      settings: { sound: true, music: false, usage: extra.usage ?? true },
      onToggle: extra.onToggle ?? noop,
      onReset: extra.onReset ?? noop,
      onBack: noop,
    });
  }

  it('has a switch for sound, music and usage data, a privacy link, reset and back', () => {
    const root = make();
    expect(root.dataset.screen).toBe('settings');
    expect(ids(root)).toEqual(['sound', 'music', 'usage', 'privacy', 'reset', 'back']);
    expect(root.querySelector('[data-control="sound"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('[data-control="music"]')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('has the usage data switch, labelled Usage data, on by default', () => {
    const usage = make().querySelector<HTMLElement>('[data-control="usage"]')!;
    expect(usage.tagName).toBe('BUTTON');
    expect(usage.textContent).toBe('Usage data');
    expect(usage.getAttribute('aria-pressed')).toBe('true');
    expect(make({ usage: false }).querySelector('[data-control="usage"]')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('flips the usage data switch and reports usage with the new value', () => {
    const seen: string[] = [];
    const root = make({ onToggle: (n, v) => seen.push(`${n}:${v}`) });
    click(root, 'usage');
    expect(seen).toEqual(['usage:false']);
    expect(root.querySelector('[data-control="usage"]')?.getAttribute('aria-pressed')).toBe('false');
    click(root, 'usage');
    expect(seen).toEqual(['usage:false', 'usage:true']);
  });

  it('has a Privacy link to ../privacy/ that opens in the same tab', () => {
    const link = make().querySelector<HTMLAnchorElement>('[data-control="privacy"]')!;
    expect(link.tagName).toBe('A');
    expect(link.textContent).toBe('Privacy');
    expect(link.getAttribute('href')).toBe('../privacy/');
    expect(link.hasAttribute('target')).toBe(false);
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

describe('watch screen proof row', () => {
  const sizes: [number, number][] = [[360, 640], [768, 1024], [1920, 1080]];
  const texts = ['Proved in 2 actions', 'Proved: every jump has 9 ticks or more', 'This proof is out of date'];
  const safe = { top: 0, right: 0, bottom: 0, left: 0 };
  const intersects = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it('puts the proof line on its own row above the scene, so a HUD line of the scene never meets it', () => {
    for (const [w, h] of sizes) {
      for (const fontSize of [17, 18]) {
        for (const text of texts) {
          const layout = watchLayout(w, h, safe, text, fontSize);
          const where = `${w}x${h} ${fontSize}px "${text}"`;
          expect(layout.proof, where).not.toBeNull();
          const proof = layout.proof!;
          expect(proof.x, where).toBeGreaterThanOrEqual(16);
          expect(proof.x + proof.w, where).toBeLessThanOrEqual(w - 16);
          expect(proof.y + proof.h, where).toBeLessThanOrEqual(layout.sceneSafe.top);
          // Both games draw their HUD line centred at 36 px below the top of their safe area, 24 px high.
          const scene = { width: w, height: h, items: [{ kind: 'text' as const, id: 'hud', layer: 'hud' as const, x: w / 2, y: layout.sceneSafe.top + 36, text: 'Turn 0 of 6', size: 24, fill: '#ffffff', align: 'center' as const }] };
          for (const hud of hudTextBoxes(scene)) expect(intersects(hud, proof), where).toBe(false);
        }
      }
    }
  });

  it('makes the row taller when the text needs two lines', () => {
    const one = watchLayout(1920, 1080, safe, 'Proved: every jump has 9 ticks or more', 18);
    const narrow = watchLayout(200, 640, safe, 'Proved: every jump has 9 ticks or more', 18);
    expect(narrow.proof!.h).toBeGreaterThan(one.proof!.h);
    expect(narrow.sceneSafe.top).toBeGreaterThan(one.sceneSafe.top);
  });

  it('keeps the scene top at the safe area when there is no proof line', () => {
    const layout = watchLayout(360, 640, { top: 20, right: 0, bottom: 0, left: 0 }, null, 18);
    expect(layout.proof).toBeNull();
    expect(layout.sceneSafe.top).toBe(20);
  });

  it('draws the proof line in the box of the layout', () => {
    const view = watchScreen(document, { width: 360, height: 640, safe, kind: 'turn', buttons: [], fontSize: 18, on: { back: noop, speed: noop } });
    view.setProof('Proved in 2 actions');
    const line = view.root.querySelector<HTMLElement>('[data-proof="line"]')!;
    const box = watchLayout(360, 640, safe, 'Proved in 2 actions', 18).proof!;
    expect([line.style.left, line.style.top, line.style.width]).toEqual([`${box.x}px`, `${box.y}px`, `${box.w}px`]);
    expect(line.hidden).toBe(false);
  });
});

describe('theme css', () => {
  it('dims a disabled button, so nobody tries to press it', () => {
    const css = themeCss(neutralTheme());
    expect(css).toMatch(/button:disabled[^{]*\{[^}]*opacity: 0\.4[0-9]*;/);
  });

  it('scales the menu type and buttons with the viewport, from 1 at 360x640 up to 2 at 1920x1080', () => {
    const css = themeCss(neutralTheme());
    expect(css).toContain('--u: clamp(1px, min(calc(1px + (100vw - 360px) / 1560), calc(1px + (100vh - 640px) / 440)), 2px)');
    expect(css).toMatch(/button, a\[data-control\] \{[^}]*min-height: calc\(44 \* var\(--u\)\)/);
    // The play and watch screens place their controls in px, so they keep the unscaled size.
    expect(css).toMatch(/\[data-screen="play"\], \[data-screen="watch"\] \{[^}]*--u: 1px/);
  });

  it('has a visible focus mark, the button radius and the palette', () => {
    const css = themeCss(neutralTheme());
    expect(css).toContain(':focus-visible');
    expect(css).toContain('border-radius: 8px');
    expect(css).toContain('#101830');
    expect(css).not.toMatch(/https?:|url\(/);
  });
});
