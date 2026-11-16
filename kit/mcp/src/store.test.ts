import { describe, expect, it } from 'vitest';
import { createStore } from './store';

describe('session store', () => {
  it('gives the ids s1 to s8 to the first eight sessions', () => {
    const store = createStore<string>();
    const ids = Array.from({ length: 8 }, (_, i) => store.add(`item${i + 1}`));
    expect(ids).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']);
    expect(store.get('s1')).toBe('item1');
    expect(store.get('s8')).toBe('item8');
  });

  it('drops the least recently used session when a ninth is added', () => {
    const store = createStore<string>();
    for (let i = 1; i <= 8; i++) store.add(`item${i}`);
    expect(store.add('item9')).toBe('s9');
    expect(store.get('s1')).toBeUndefined();
    expect(store.get('s2')).toBe('item2');
    expect(store.size()).toBe(8);
  });

  it('counts a get as a use', () => {
    const store = createStore<string>();
    for (let i = 1; i <= 8; i++) store.add(`item${i}`);
    expect(store.get('s1')).toBe('item1');
    store.add('item9');
    expect(store.get('s1')).toBe('item1');
    expect(store.get('s2')).toBeUndefined();
  });

  it('reports an evicted or never issued id as unknown', () => {
    const store = createStore<string>();
    expect(store.get('s1')).toBeUndefined();
    expect(store.get('nope')).toBeUndefined();
    for (let i = 1; i <= 9; i++) store.add(`item${i}`);
    expect(store.get('s1')).toBeUndefined();
  });

  it('never reuses an id', () => {
    const store = createStore<string>();
    const seen = new Set<string>();
    for (let i = 1; i <= 30; i++) seen.add(store.add(`item${i}`));
    expect(seen.size).toBe(30);
    expect(store.add('later')).toBe('s31');
    expect(store.get('s1')).toBeUndefined();
  });

  it('does not count an unknown get as a use of anything', () => {
    const store = createStore<string>();
    for (let i = 1; i <= 8; i++) store.add(`item${i}`);
    store.get('s99');
    store.add('item9');
    expect(store.get('s1')).toBeUndefined();
  });
});
