// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createStore } from './storage';
import { finishLevel, starsFor, turnStars } from './stars';
import type { GameTexts } from './types';

beforeEach(() => {
  localStorage.clear();
});

describe('turnStars with par 4', () => {
  it('gives 3 stars for 3 and 4 actions', () => {
    expect(turnStars(3, 4)).toBe(3);
    expect(turnStars(4, 4)).toBe(3);
  });
  it('gives 2 stars for 5 and 6 actions', () => {
    expect(turnStars(5, 4)).toBe(2);
    expect(turnStars(6, 4)).toBe(2);
  });
  it('gives 1 star for 7 actions', () => {
    expect(turnStars(7, 4)).toBe(1);
    expect(turnStars(40, 4)).toBe(1);
  });
});

// A rule with neutral names that has the shape of the tick star rule of the design:
// all taken is 3, at least half is 2, else 1, and a course with nothing to take is 3.
type Course = { items: number };
const texts: GameTexts<Course> = {
  reasons: {},
  tickStars(start, end) {
    const taken = start.items - end.items;
    if (start.items === 0 || taken === start.items) return 3;
    return taken * 2 >= start.items ? 2 : 1;
  },
};

describe('starsFor', () => {
  it('passes the start and the end state of a tick game to tickStars', () => {
    const cases: [number, number, 1 | 2 | 3][] = [
      [4, 0, 3],
      [4, 2, 2],
      [4, 3, 1],
      [4, 4, 1],
      [3, 1, 2],
      [3, 2, 1],
      [0, 0, 3],
    ];
    for (const [start, left, expected] of cases) {
      expect(starsFor({ kind: 'tick', texts, start: { items: start }, end: { items: left }, actions: 0, par: undefined }), `${start} start, ${left} left`).toBe(expected);
    }
  });

  it('throws for a tick game that has no tickStars', () => {
    expect(() => starsFor({ kind: 'tick', texts: { reasons: {} }, start: { items: 1 }, end: { items: 0 }, actions: 0, par: undefined })).toThrow(/tickStars/);
  });

  it('uses the actions and the par for a turn game', () => {
    const base = { kind: 'turn' as const, texts: { reasons: {} }, start: null, end: null };
    expect(starsFor({ ...base, actions: 4, par: 4 })).toBe(3);
    expect(starsFor({ ...base, actions: 6, par: 4 })).toBe(2);
    expect(starsFor({ ...base, actions: 7, par: 4 })).toBe(1);
  });

  it('gives 1 star for a won turn level when the par is unknown', () => {
    expect(starsFor({ kind: 'turn', texts: { reasons: {} }, start: null, end: null, actions: 2, par: undefined })).toBe(1);
  });
});

describe('finishLevel and progress', () => {
  it('saves stars and the fewest actions of a turn level and never gets worse', () => {
    const store = createStore('game-a', localStorage);
    finishLevel(store, 'turn', 'lv-1', 2, 6);
    finishLevel(store, 'turn', 'lv-1', 1, 9);
    expect(store.read().levels['lv-1']).toEqual({ stars: 2, best: 6 });
    finishLevel(store, 'turn', 'lv-1', 3, 4);
    expect(store.read().levels['lv-1']).toEqual({ stars: 3, best: 4 });
    finishLevel(store, 'turn', 'lv-1', 2, 5);
    expect(store.read().levels['lv-1']).toEqual({ stars: 3, best: 4 });
  });

  it('saves the highest score of a tick level', () => {
    const store = createStore('game-a', localStorage);
    finishLevel(store, 'tick', 'lv-1', 1, 2);
    finishLevel(store, 'tick', 'lv-1', 2, 5);
    finishLevel(store, 'tick', 'lv-1', 1, 3);
    expect(store.read().levels['lv-1']).toEqual({ stars: 2, best: 5 });
  });
});
