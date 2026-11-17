import { checkTheme } from '@kit/shell';
import type { Viewport } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { gameTheme } from '../theme';
import def from './def';
import { gameInput } from './input';

const viewport: Viewport = { width: 360, height: 568, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
const start = () => def.init('l1', 1);

describe('the input map', () => {
  it('presses the lamp that the pointer holds, also in the last row and column', () => {
    expect(gameInput.toAction({ type: 'pointer', itemIds: ['lamp-2-1', 'background'] }, start())).toBe('press:2,1');
    expect(gameInput.toAction({ type: 'pointer', itemIds: ['lamp-3-3'] }, start())).toBe('press:3,3');
  });

  it('does nothing for a lamp that is not on the board', () => {
    expect(gameInput.toAction({ type: 'pointer', itemIds: ['lamp-4-0'] }, start())).toBeNull();
  });

  it('does nothing for the background, for an empty list and for a key', () => {
    expect(gameInput.toAction({ type: 'pointer', itemIds: ['background'] }, start())).toBeNull();
    expect(gameInput.toAction({ type: 'pointer', itemIds: [] }, start())).toBeNull();
    expect(gameInput.toAction({ type: 'key', key: ' ' }, start())).toBeNull();
  });

  it('gives an action text that the game lists', () => {
    const text = gameInput.toAction({ type: 'pointer', itemIds: ['lamp-0-0'] }, start());
    expect(def.actions(start()).map((a) => def.encodeAction(a))).toContain(text);
  });

  it('has lessons with unique ids, at most 2 words, on an item of the first scene', () => {
    const ids = new Set(def.view(start(), viewport).items.map((item) => item.id));
    expect(new Set(gameInput.lessons.map((l) => l.id)).size).toBe(gameInput.lessons.length);
    for (const lesson of gameInput.lessons) {
      expect(lesson.text.trim().split(/\s+/).length, lesson.id).toBeLessThanOrEqual(2);
      expect(ids.has(lesson.anchor), lesson.anchor).toBe(true);
    }
  });

  it('names the lamp of a press for the watch pointer mark', () => {
    expect(gameInput.anchorFor('press:1,2')).toBe('lamp-1-2');
    expect(gameInput.anchorFor('wait')).toBeNull();
  });
});

describe('the theme', () => {
  it('has no problem for checkTheme', () => {
    expect(checkTheme(gameTheme)).toEqual([]);
  });
});
