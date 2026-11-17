import { describe, expect, it } from 'vitest';
import type { Viewport } from '@kit/core';
import def from './def';
import { runnerInput } from './input';
import { levelPlans } from './proof';
import { runnerTexts } from './results';
import type { RunnerState } from './rules/state';

const viewport: Viewport = { width: 360, height: 568, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
const start = (): RunnerState => def.init('r01', 1);
const pointer = (itemIds: string[]) => ({ type: 'pointer' as const, itemIds });
const key = (k: string) => ({ type: 'key' as const, key: k });

describe('runner input', () => {
  const s = start();

  it('jumps for any pointer event, with any list of ids', () => {
    expect(runnerInput.toAction(pointer([]), s)).toBe('jump');
    expect(runnerInput.toAction(pointer(['player']), s)).toBe('jump');
    expect(runnerInput.toAction(pointer(['ground-3', 'hud-score', 'nothing']), s)).toBe('jump');
  });

  it('jumps for a space and gives null for any other key', () => {
    expect(runnerInput.toAction(key(' '), s)).toBe('jump');
    for (const k of ['a', 'Enter', 'ArrowUp', 'Space', '1', '']) expect(runnerInput.toAction(key(k), s), JSON.stringify(k)).toBeNull();
  });

  it('has idle none and no buttons', () => {
    expect(runnerInput.idle).toBe('none');
    expect(runnerInput.buttons).toEqual([]);
  });

  it('names player for jump and null for none and for anything else', () => {
    expect(runnerInput.anchorFor('jump')).toBe('player');
    expect(runnerInput.anchorFor('none')).toBeNull();
    expect(runnerInput.anchorFor('')).toBeNull();
    expect(runnerInput.anchorFor('wait')).toBeNull();
  });

  it('lists the key lines for the how to play screen', () => {
    expect(runnerInput.keys?.length).toBeGreaterThan(0);
  });

  it('gives actions that the game knows', () => {
    expect(def.decodeAction(runnerInput.idle ?? '')).not.toBeNull();
    expect(def.decodeAction('jump')).not.toBeNull();
  });
});

describe('runner lessons', () => {
  it('are the two of the requirement, in order', () => {
    expect(runnerInput.lessons).toEqual([
      { id: 'jump', anchor: 'player', text: 'Tap: jump' },
      { id: 'candles', anchor: 'hud-score', text: 'Take candles' },
    ]);
  });

  it('have unique ids, at most 2 words each, and at most 4 lessons', () => {
    const lessons = runnerInput.lessons;
    expect(lessons.length).toBeLessThanOrEqual(4);
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
    for (const lesson of lessons) expect(lesson.text.trim().split(/\s+/).length, lesson.id).toBeLessThanOrEqual(2);
  });

  it('are anchored on an item of the first scene of r01 or on a button of the input map', () => {
    const ids = new Set(def.view(start(), viewport).items.map((i) => i.id));
    const buttons = new Set(runnerInput.buttons.map((b) => b.id));
    for (const lesson of runnerInput.lessons) {
      expect(ids.has(lesson.anchor) || buttons.has(lesson.anchor), `${lesson.id} anchor ${lesson.anchor}`).toBe(true);
    }
  });
});

describe('runner texts', () => {
  it('gives the two end reason texts', () => {
    expect(runnerTexts.reasons).toEqual({ hit: 'Hit an obstacle', fell: 'Fell in a gap' });
  });
});

// A start state with `total` candles, and an end state where `taken` of them are gone.
function candleCase(total: number, taken: number): { start: RunnerState; end: RunnerState } {
  const candles = Array.from({ length: total }, (_, i) => i + 5);
  const begin = { ...start(), candles };
  return { start: begin, end: { ...begin, candles: candles.slice(taken) } };
}

describe('runner stars', () => {
  const stars = (total: number, taken: number) => {
    const c = candleCase(total, taken);
    return runnerTexts.tickStars?.(c.start, c.end);
  };

  it('gives 3 for every candle, 2 for at least half, 1 otherwise, with 4 candles', () => {
    expect(stars(4, 4)).toBe(3);
    expect(stars(4, 3)).toBe(2);
    expect(stars(4, 2)).toBe(2);
    expect(stars(4, 1)).toBe(1);
    expect(stars(4, 0)).toBe(1);
  });

  it('gives 3, 2 and 1 for 3 candles with 3, 2 and 1 taken', () => {
    expect(stars(3, 3)).toBe(3);
    expect(stars(3, 2)).toBe(2);
    expect(stars(3, 1)).toBe(1);
  });

  it('gives 3 for a course with no candle', () => {
    expect(stars(0, 0)).toBe(3);
  });
});

describe('runner fairTicks', () => {
  it('equals the minWindow of the plan of each course', () => {
    const wanted: Record<string, number> = { r01: 9, r02: 9, r03: 6, r04: 6, r05: 4, r06: 4 };
    for (const [id, n] of Object.entries(wanted)) expect(runnerTexts.fairTicks?.(id), id).toBe(n);
  });

  it('is the same number as levelPlans for every plan, so that the two cannot drift apart', () => {
    for (const [id, plan] of Object.entries(levelPlans)) expect(runnerTexts.fairTicks?.(id), id).toBe(plan.minWindow);
  });

  it('gives null for a course that has no plan', () => {
    expect(runnerTexts.fairTicks?.('r99')).toBeNull();
    expect(runnerTexts.fairTicks?.('')).toBeNull();
    expect(runnerTexts.fairTicks?.('toString')).toBeNull();
  });
});
