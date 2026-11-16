export const MAX_SESSIONS = 8;

export interface Store<T> {
  /** Keeps the item under a new id (`s1`, `s2`, ...). Drops the least recently used item when more than the limit would be held. */
  add(item: T): string;
  /** Returns the item and marks it as used. Returns undefined for an unknown or evicted id. */
  get(id: string): T | undefined;
  size(): number;
}

export function createStore<T>(limit: number = MAX_SESSIONS): Store<T> {
  // A Map keeps insertion order. Re-inserting an id on each use puts the least recently used id first.
  const items = new Map<string, T>();
  let counter = 0;
  return {
    add(item) {
      counter += 1;
      const id = `s${counter}`;
      items.set(id, item);
      while (items.size > limit) {
        const oldest = items.keys().next();
        if (oldest.done) break;
        items.delete(oldest.value);
      }
      return id;
    },
    get(id) {
      if (!items.has(id)) return undefined;
      const item = items.get(id) as T;
      items.delete(id);
      items.set(id, item);
      return item;
    },
    size: () => items.size,
  };
}
