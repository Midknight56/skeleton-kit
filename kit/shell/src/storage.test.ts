// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createStore, storageKey } from './storage';

beforeEach(() => {
  localStorage.clear();
});

describe('storageKey', () => {
  it('is kit.<gameId>.v1', () => {
    expect(storageKey('game-a')).toBe('kit.game-a.v1');
  });
});

describe('createStore with working storage', () => {
  it('starts empty with every switch on', () => {
    const store = createStore('game-a', localStorage);
    expect(store.persistent).toBe(true);
    expect(store.read()).toEqual({ version: 1, levels: {}, settings: { sound: true, music: true, usage: true }, lessons: {} });
  });

  it('saves a result under the key and reads it back in a new store', () => {
    createStore('game-a', localStorage).recordResult('lv-1', { stars: 3, best: 2 }, 'turn');
    const raw = JSON.parse(localStorage.getItem('kit.game-a.v1') ?? 'null') as { version: number; levels: Record<string, unknown> };
    expect(raw.version).toBe(1);
    expect(raw.levels['lv-1']).toEqual({ stars: 3, best: 2 });
    expect(createStore('game-a', localStorage).read().levels['lv-1']).toEqual({ stars: 3, best: 2 });
  });

  it('never lowers stars or best on a turn level, and a lower best wins', () => {
    const store = createStore('game-a', localStorage);
    store.recordResult('lv-1', { stars: 2, best: 5 }, 'turn');
    store.recordResult('lv-1', { stars: 1, best: 7 }, 'turn');
    expect(store.read().levels['lv-1']).toEqual({ stars: 2, best: 5 });
    store.recordResult('lv-1', { stars: 3, best: 4 }, 'turn');
    expect(store.read().levels['lv-1']).toEqual({ stars: 3, best: 4 });
  });

  it('never lowers stars or best on a tick level, and a higher best wins', () => {
    const store = createStore('game-a', localStorage);
    store.recordResult('lv-1', { stars: 2, best: 3 }, 'tick');
    store.recordResult('lv-1', { stars: 1, best: 1 }, 'tick');
    expect(store.read().levels['lv-1']).toEqual({ stars: 2, best: 3 });
    store.recordResult('lv-1', { stars: 2, best: 4 }, 'tick');
    expect(store.read().levels['lv-1']).toEqual({ stars: 2, best: 4 });
  });

  it('counts a level as finished at 1 star or more', () => {
    const store = createStore('game-a', localStorage);
    expect(store.isFinished('lv-1')).toBe(false);
    store.recordResult('lv-1', { stars: 1, best: 9 }, 'turn');
    expect(store.isFinished('lv-1')).toBe(true);
  });

  it('keeps both switches after a reload', () => {
    const store = createStore('game-a', localStorage);
    store.setSetting('sound', false);
    store.setSetting('music', false);
    expect(createStore('game-a', localStorage).read().settings).toEqual({ sound: false, music: false, usage: true });
  });

  it('saves the usage data switch at once and keeps it after a reload', () => {
    createStore('game-a', localStorage).setSetting('usage', false);
    const raw = JSON.parse(localStorage.getItem('kit.game-a.v1') ?? 'null') as { settings: Record<string, boolean> };
    expect(raw.settings.usage).toBe(false);
    expect(createStore('game-a', localStorage).read().settings.usage).toBe(false);
  });

  it('reads a file from before the usage switch as usage on', () => {
    localStorage.setItem('kit.game-a.v1', JSON.stringify({ version: 1, levels: {}, settings: { sound: false, music: true }, lessons: {} }));
    expect(createStore('game-a', localStorage).read().settings).toEqual({ sound: false, music: true, usage: true });
  });

  it('ignores a usage value that is not a boolean', () => {
    localStorage.setItem('kit.game-a.v1', JSON.stringify({ version: 1, levels: {}, settings: { usage: 'no' }, lessons: {} }));
    expect(createStore('game-a', localStorage).read().settings.usage).toBe(true);
  });

  it('counts lessons and keeps the count', () => {
    const store = createStore('game-a', localStorage);
    expect(store.lessonCount('tap')).toBe(0);
    store.bumpLesson('tap');
    store.bumpLesson('tap');
    expect(createStore('game-a', localStorage).lessonCount('tap')).toBe(2);
  });

  it('ignores a value that does not parse', () => {
    localStorage.setItem('kit.game-a.v1', '{not json');
    const store = createStore('game-a', localStorage);
    expect(store.read().levels).toEqual({});
    store.recordResult('lv-1', { stars: 1, best: 1 }, 'turn');
    expect(JSON.parse(localStorage.getItem('kit.game-a.v1') ?? '{}')).toMatchObject({ version: 1 });
  });

  it('ignores a value with another version', () => {
    localStorage.setItem('kit.game-a.v1', JSON.stringify({ version: 2, levels: { 'lv-1': { stars: 3, best: 1 } } }));
    expect(createStore('game-a', localStorage).read().levels).toEqual({});
  });

  it('reset removes progress, switches and lessons', () => {
    const store = createStore('game-a', localStorage);
    store.recordResult('lv-1', { stars: 3, best: 1 }, 'turn');
    store.setSetting('sound', false);
    store.bumpLesson('tap');
    store.reset();
    expect(store.read()).toEqual({ version: 1, levels: {}, settings: { sound: true, music: true, usage: true }, lessons: {} });
    expect(createStore('game-a', localStorage).read().levels).toEqual({});
  });

  it('reset keeps the usage data switch off, so a reset never turns the beacon back on', () => {
    const store = createStore('game-a', localStorage);
    store.setSetting('usage', false);
    store.reset();
    expect(store.read().settings.usage).toBe(false);
  });
});

describe('createStore with blocked storage', () => {
  it('works in memory when there is no backend', () => {
    const store = createStore('game-a', null);
    expect(store.persistent).toBe(false);
    store.recordResult('lv-1', { stars: 2, best: 3 }, 'turn');
    expect(store.read().levels['lv-1']).toEqual({ stars: 2, best: 3 });
  });

  it('switches to memory when a write throws', () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
    } as unknown as Storage;
    const store = createStore('game-a', broken);
    store.recordResult('lv-1', { stars: 2, best: 3 }, 'turn');
    expect(store.persistent).toBe(false);
    expect(store.read().levels['lv-1']).toEqual({ stars: 2, best: 3 });
  });

  it('switches to memory when a read throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    } as unknown as Storage;
    const store = createStore('game-a', broken);
    expect(store.read().levels).toEqual({});
    expect(store.persistent).toBe(false);
  });
});
