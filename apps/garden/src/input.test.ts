import { describe, expect, it } from 'vitest';
import type { Viewport } from '@kit/core';
import def from './def';
import { gardenInput } from './input';
import { gardenTexts } from './results';
import type { GardenState } from './rules/state';

const viewport: Viewport = { width: 360, height: 568, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
const start = (): GardenState => def.init('g01', 1);
const lit = (k: number): GardenState => ({ ...start(), lit: k });
const pointer = (itemIds: string[]) => ({ type: 'pointer' as const, itemIds });
const key = (k: string) => ({ type: 'key' as const, key: k });

describe('the first level g01', () => {
  it('has the rows the design names', () => {
    expect(start().cells).toEqual(['2f1..', '...#.', '.f...']);
    expect(start().moths.length).toBe(1);
  });
});

describe('garden input with no lantern lit', () => {
  const s = start();
  it('lights the first lantern item in the list, even with a moth over it', () => {
    expect(gardenInput.toAction(pointer(['moth-1', 'lantern-1']), s)).toBe('light:1');
  });
  it('lights lantern 2', () => {
    expect(gardenInput.toAction(pointer(['lantern-2']), s)).toBe('light:2');
  });
  it('gives null for a flower and for an empty list', () => {
    expect(gardenInput.toAction(pointer(['flower-1-0']), s)).toBeNull();
    expect(gardenInput.toAction(pointer([]), s)).toBeNull();
  });
  it('gives null for key 3 (no such lantern) and for a space', () => {
    expect(gardenInput.toAction(key('3'), s)).toBeNull();
    expect(gardenInput.toAction(key(' '), s)).toBeNull();
  });
  it('lights a lantern with key 1 and key 2', () => {
    expect(gardenInput.toAction(key('1'), s)).toBe('light:1');
    expect(gardenInput.toAction(key('2'), s)).toBe('light:2');
  });
  it('gives null for any other key', () => {
    for (const k of ['a', 'Enter', '0', '6', 'ArrowUp']) expect(gardenInput.toAction(key(k), s), k).toBeNull();
  });
});

describe('garden input with lantern 1 lit', () => {
  const s = lit(1);
  it('waits on the lit lantern and switches on the other one', () => {
    expect(gardenInput.toAction(pointer(['lantern-1']), s)).toBe('wait');
    expect(gardenInput.toAction(pointer(['lantern-2']), s)).toBe('light:2');
  });
  it('waits on key 1 and on a space, and switches on key 2', () => {
    expect(gardenInput.toAction(key('1'), s)).toBe('wait');
    expect(gardenInput.toAction(key(' '), s)).toBe('wait');
    expect(gardenInput.toAction(key('2'), s)).toBe('light:2');
  });
});

describe('garden input shape', () => {
  it('has idle null, because the garden puzzle is a turn game', () => {
    expect(gardenInput.idle).toBeNull();
  });

  it('has one button, wait, that applies wait', () => {
    expect(gardenInput.buttons).toEqual([{ id: 'wait', label: 'Wait', action: 'wait' }]);
  });

  it('names lantern-k for light:k, wait for wait, and null for the rest', () => {
    expect(gardenInput.anchorFor('light:1')).toBe('lantern-1');
    expect(gardenInput.anchorFor('light:5')).toBe('lantern-5');
    expect(gardenInput.anchorFor('wait')).toBe('wait');
    expect(gardenInput.anchorFor('jump')).toBeNull();
    expect(gardenInput.anchorFor('')).toBeNull();
  });

  it('lists the key lines for the how to play screen', () => {
    expect(gardenInput.keys?.length).toBeGreaterThan(0);
  });
});

describe('garden lessons', () => {
  it('are the three of the requirement, in order', () => {
    expect(gardenInput.lessons).toEqual([
      { id: 'tap-lantern', anchor: 'lantern-1', text: 'Tap lantern' },
      { id: 'wait-turn', anchor: 'wait', text: 'Then wait' },
      { id: 'switch-lantern', anchor: 'lantern-2', text: 'Or switch' },
    ]);
  });

  it('have unique ids, at most 2 words each, and at most 4 lessons', () => {
    const lessons = gardenInput.lessons;
    expect(lessons.length).toBeLessThanOrEqual(4);
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
    for (const lesson of lessons) {
      expect(lesson.text.trim().split(/\s+/).length, lesson.id).toBeLessThanOrEqual(2);
    }
  });

  it('are anchored on an item of the first scene of g01 or on a button of the input map', () => {
    const ids = new Set(def.view(start(), viewport).items.map((i) => i.id));
    const buttons = new Set(gardenInput.buttons.map((b) => b.id));
    for (const lesson of gardenInput.lessons) {
      expect(ids.has(lesson.anchor) || buttons.has(lesson.anchor), `${lesson.id} anchor ${lesson.anchor}`).toBe(true);
    }
  });
});

describe('garden texts', () => {
  it('gives the two end reason texts', () => {
    expect(gardenTexts.reasons).toEqual({ web: 'Caught in a web', turns: 'Out of turns' });
  });

  it('has no tick functions, because the game is a turn game', () => {
    expect(gardenTexts.tickStars).toBeUndefined();
    expect(gardenTexts.fairTicks).toBeUndefined();
  });
});
