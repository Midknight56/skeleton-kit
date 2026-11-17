// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { lessonProblems, lessonsToShow, showHints } from './lessons';
import { createStore } from './storage';
import type { Lesson } from './types';
import { howScreen } from './screens/how';

beforeEach(() => {
  localStorage.clear();
});

const lessons: Lesson[] = [
  { id: 'tap-one', anchor: 'item-1', text: 'Tap here' },
  { id: 'then-wait', anchor: 'btn-1', text: 'Then wait' },
];

describe('lessonsToShow', () => {
  it('shows each lesson 3 times on a first level started 4 times, and the fourth start shows none', () => {
    const shown: string[][] = [];
    for (let start = 0; start < 4; start++) {
      const store = createStore('game-a', localStorage);
      shown.push(lessonsToShow(store, lessons, true).map((l) => l.id));
    }
    expect(shown).toEqual([['tap-one', 'then-wait'], ['tap-one', 'then-wait'], ['tap-one', 'then-wait'], []]);
  });

  it('counts the showings in storage', () => {
    const store = createStore('game-a', localStorage);
    lessonsToShow(store, lessons, true);
    expect(createStore('game-a', localStorage).lessonCount('tap-one')).toBe(1);
  });

  it('shows nothing on a level that is not the first and counts nothing', () => {
    const store = createStore('game-a', localStorage);
    expect(lessonsToShow(store, lessons, false)).toEqual([]);
    expect(store.lessonCount('tap-one')).toBe(0);
  });

  it('keeps counting each lesson alone', () => {
    const store = createStore('game-a', localStorage);
    store.bumpLesson('tap-one');
    store.bumpLesson('tap-one');
    store.bumpLesson('tap-one');
    expect(lessonsToShow(store, lessons, true).map((l) => l.id)).toEqual(['then-wait']);
  });

  it('never shows a lesson a fourth time, for any order of starts (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }), (firstFlags) => {
        localStorage.clear();
        const counts: Record<string, number> = {};
        for (const isFirst of firstFlags) {
          const store = createStore('game-a', localStorage);
          for (const lesson of lessonsToShow(store, lessons, isFirst)) counts[lesson.id] = (counts[lesson.id] ?? 0) + 1;
        }
        for (const n of Object.values(counts)) expect(n).toBeLessThanOrEqual(3);
      }),
    );
  });
});

describe('lessonProblems', () => {
  it('accepts unique ids, at most 2 words and at most 4 lessons', () => {
    expect(lessonProblems(lessons)).toEqual([]);
  });
  it('names a repeated id', () => {
    expect(lessonProblems([lessons[0]!, lessons[0]!]).join(' ')).toContain('tap-one');
  });
  it('names a text of 3 words', () => {
    expect(lessonProblems([{ id: 'long', anchor: 'a', text: 'Tap the thing' }]).join(' ')).toContain('long');
  });
  it('names a list of 5 lessons', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, anchor: 'x', text: 'Go' }));
    expect(lessonProblems(five).length).toBe(1);
  });
});

describe('showHints', () => {
  const boxes: Record<string, { x: number; y: number; w: number; h: number } | undefined> = {
    'item-1': { x: 100, y: 200, w: 40, h: 40 },
    'btn-1': { x: 16, y: 580, w: 44, h: 44 },
  };

  it('puts one hint box next to the box of each anchor and takes no pointer events', () => {
    const container = document.createElement('div');
    const hints = showHints(document, container, lessons, (anchor) => boxes[anchor] ?? null);
    const els = Array.from(container.querySelectorAll<HTMLElement>('[data-hint]'));
    expect(els.map((e) => e.textContent)).toEqual(['Tap here', 'Then wait']);
    expect(els.map((e) => e.dataset.hint)).toEqual(['tap-one', 'then-wait']);
    expect(els.every((e) => e.style.pointerEvents === 'none')).toBe(true);
    expect(els[0]!.style.left).not.toBe('');
    expect(els[0]!.style.top).not.toBe('');
    hints.remove();
  });

  it('skips a lesson whose anchor has no box', () => {
    const container = document.createElement('div');
    showHints(document, container, lessons, (anchor) => (anchor === 'item-1' ? boxes['item-1']! : null));
    expect(container.querySelectorAll('[data-hint]').length).toBe(1);
  });

  it('removes every hint at the first applied action', () => {
    const container = document.createElement('div');
    const hints = showHints(document, container, lessons, (anchor) => boxes[anchor] ?? null);
    expect(container.querySelectorAll('[data-hint]').length).toBe(2);
    hints.remove();
    expect(container.querySelectorAll('[data-hint]').length).toBe(0);
    hints.remove();
  });
});

describe('how to play screen', () => {
  it('lists every lesson and every key', () => {
    const root = howScreen(document, { lessons, keys: ['1: first', 'Space: wait'], onBack: () => undefined });
    const items = Array.from(root.querySelectorAll('li')).map((li) => li.textContent);
    expect(items).toEqual(['Tap here', 'Then wait', '1: first', 'Space: wait']);
  });
});
