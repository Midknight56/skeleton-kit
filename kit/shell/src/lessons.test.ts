// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { lessonProblems, lessonsToShow, showHints } from './lessons';
import { createStore } from './storage';
import type { Rect } from './layout';
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
  const area = { width: 360, height: 640, safe: { top: 0, right: 0, bottom: 0, left: 0 }, fontSize: 14 };
  const boxes: Record<string, { x: number; y: number; w: number; h: number } | undefined> = {
    'item-1': { x: 100, y: 200, w: 40, h: 40 },
    'btn-1': { x: 16, y: 580, w: 44, h: 44 },
  };

  it('sets the text size of a chip from the scale of the area, and leaves it to the page style at scale 1', () => {
    const container = document.createElement('div');
    showHints(document, container, lessons, (anchor) => boxes[anchor] ?? null, { ...area, fontSize: 14, scale: 2 });
    const els = Array.from(container.querySelectorAll<HTMLElement>('[data-hint]'));
    expect(els.length).toBeGreaterThan(0);
    for (const el of els) expect(el.style.fontSize).toBe('28px');
    const plain = document.createElement('div');
    showHints(document, plain, lessons, (anchor) => boxes[anchor] ?? null, { ...area, scale: 1 });
    for (const el of Array.from(plain.querySelectorAll<HTMLElement>('[data-hint]'))) expect(el.style.fontSize).toBe('');
  });

  it('puts one hint box next to the box of each anchor and takes no pointer events', () => {
    const container = document.createElement('div');
    const hints = showHints(document, container, lessons, (anchor) => boxes[anchor] ?? null, area);
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
    showHints(document, container, lessons, (anchor) => (anchor === 'item-1' ? boxes['item-1']! : null), area);
    expect(container.querySelectorAll('[data-hint]').length).toBe(1);
  });

  it('removes every hint at the first applied action', () => {
    const container = document.createElement('div');
    const hints = showHints(document, container, lessons, (anchor) => boxes[anchor] ?? null, area);
    expect(container.querySelectorAll('[data-hint]').length).toBe(2);
    hints.remove();
    expect(container.querySelectorAll('[data-hint]').length).toBe(0);
    hints.remove();
  });
});

// The faults seen on the 1920 by 1080 play screen: chips in the top bar, next to the counter text.
// The numbers below are those of that screen: a 5 by 3 board of 317 px cells starting at x 167 and
// y 56, a counter text of 24 px at the top, three buttons in a strip that is 72 px high.
describe('showHints placement on a wide screen', () => {
  const W = 1920;
  const H = 1080;
  const STRIP_TOP = H - 72;
  const cell = 317;
  const anchors: Record<string, Rect> = {
    'item-1': { x: 167 + 2 * cell, y: 56, w: cell, h: cell },
    'item-2': { x: 167, y: 56, w: cell, h: cell },
    'btn-1': { x: 128, y: H - 60, w: 67, h: 44 },
  };
  // The counter text, as a box measured by this test: 0.6 em a letter, from one em above the baseline.
  const counter: Rect = { x: W / 2 - (11 * 24 * 0.6) / 2, y: 36 - 24, w: 11 * 24 * 0.6, h: 24 * 1.3 };
  const buttons: Rect[] = [
    { x: 16, y: H - 60, w: 44, h: 44 },
    { x: 72, y: H - 60, w: 44, h: 44 },
    anchors['btn-1']!,
  ];
  const wide: Lesson[] = [
    { id: 'l-1', anchor: 'item-1', text: 'Tap here' },
    { id: 'l-2', anchor: 'btn-1', text: 'Then wait' },
    { id: 'l-3', anchor: 'item-2', text: 'Or switch' },
  ];
  const area = {
    width: W,
    height: H,
    safe: { top: 0, right: 0, bottom: 0, left: 0 },
    fontSize: 14,
    top: counter.y + counter.h,
    bottom: STRIP_TOP,
    avoid: [counter, ...buttons],
  };

  function gap(a: Rect, b: Rect): number {
    const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0);
    const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
    return Math.hypot(dx, dy);
  }

  function placed(): { id: string; anchor: Rect; rect: Rect }[] {
    const container = document.createElement('div');
    document.body.append(container);
    showHints(document, container, wide, (anchor) => anchors[anchor] ?? null, area);
    return Array.from(container.querySelectorAll<HTMLElement>('[data-hint]')).map((el) => {
      const lesson = wide.find((l) => l.id === el.dataset.hint)!;
      const w = parseFloat(el.style.width || '0') || Math.ceil(lesson.text.length * 14 * 0.7) + 16;
      const h = parseFloat(el.style.height || '0') || Math.ceil(14 * 1.4) + 8;
      return { id: lesson.id, anchor: anchors[lesson.anchor]!, rect: { x: parseFloat(el.style.left), y: parseFloat(el.style.top), w, h } };
    });
  }

  it('puts each chip touching its anchor or within 12 px of it', () => {
    const chips = placed();
    expect(chips.length).toBe(3);
    for (const c of chips) expect(gap(c.rect, c.anchor), c.id).toBeLessThanOrEqual(12);
  });

  it('keeps each chip out of the top bar and the control strip', () => {
    for (const c of placed()) {
      expect(c.rect.y, `${c.id} top`).toBeGreaterThanOrEqual(area.top);
      expect(c.rect.y + c.rect.h, `${c.id} bottom`).toBeLessThanOrEqual(STRIP_TOP);
    }
  });

  it('keeps each chip 12 px or more from the counter text and from every button', () => {
    for (const c of placed()) {
      for (const other of area.avoid) expect(gap(c.rect, other), `${c.id}`).toBeGreaterThanOrEqual(12);
    }
  });
});
describe('how to play screen', () => {
  it('lists every lesson and every key', () => {
    const root = howScreen(document, { lessons, keys: ['1: first', 'Space: wait'], onBack: () => undefined });
    const items = Array.from(root.querySelectorAll('li')).map((li) => li.textContent);
    expect(items).toEqual(['Tap here', 'Then wait', '1: first', 'Space: wait']);
  });
});
