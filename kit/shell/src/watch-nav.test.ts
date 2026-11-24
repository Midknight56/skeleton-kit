// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { neighbourLevels } from './watch-nav';
import { watchScreen } from './screens/watch-screen';

const ids = ['a1', 'a2', 'a3', 'a4'];

describe('the neighbour levels of the watch screen', () => {
  it('gives the next and the previous level in the order of the game', () => {
    expect(neighbourLevels(ids, null, 'a2')).toEqual({ number: 2, prev: 'a1', next: 'a3' });
  });

  it('has no previous level at the first one and no next level at the last one', () => {
    expect(neighbourLevels(ids, null, 'a1')).toEqual({ number: 1, prev: null, next: 'a2' });
    expect(neighbourLevels(ids, null, 'a4')).toEqual({ number: 4, prev: 'a3', next: null });
  });

  it('skips a level that has no proof', () => {
    expect(neighbourLevels(ids, new Set(['a1', 'a3', 'a4']), 'a1')).toEqual({ number: 1, prev: null, next: 'a3' });
    expect(neighbourLevels(ids, new Set(['a1', 'a3', 'a4']), 'a3')).toEqual({ number: 3, prev: 'a1', next: 'a4' });
  });
});

describe('the watch screen level controls', () => {
  const safe = { top: 0, right: 0, bottom: 0, left: 0 };
  const base = { width: 360, height: 640, safe, kind: 'turn' as const, buttons: [], on: { back() {}, speed() {} } };

  it('shows the level number and two controls, disabled at the ends', () => {
    const calls: string[] = [];
    const view = watchScreen(document, { ...base, nav: { number: 1, hasPrev: false, hasNext: true }, on: { ...base.on, level: (d) => calls.push(String(d)) } });
    const prev = view.root.querySelector<HTMLButtonElement>('[data-control="level-prev"]')!;
    const next = view.root.querySelector<HTMLButtonElement>('[data-control="level-next"]')!;
    expect(view.root.querySelector('[data-watch-level]')?.textContent).toBe('Level 1');
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    expect(prev.getAttribute('aria-label')).toBe('Previous level');
    expect(next.getAttribute('aria-label')).toBe('Next level');
    next.click();
    expect(calls).toEqual(['1']);
  });
});