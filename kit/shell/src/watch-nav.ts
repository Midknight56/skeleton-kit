// The level controls of the watch screen move to the neighbour level that has a proof.
export interface WatchNeighbours {
  // The place of the level in the game, counted from 1.
  number: number;
  prev: string | null;
  next: string | null;
}

// `ids` are all levels in the order of the game. `proved` holds the ids that have a proof, or is null when
// that is not known yet, which counts every level as proved.
export function neighbourLevels(ids: string[], proved: Set<string> | null, current: string): WatchNeighbours {
  const at = ids.indexOf(current);
  const has = (id: string): boolean => proved === null || proved.has(id);
  let prev: string | null = null;
  let next: string | null = null;
  for (let i = at - 1; i >= 0; i--) {
    if (has(ids[i] as string)) {
      prev = ids[i] as string;
      break;
    }
  }
  for (let i = at + 1; i < ids.length; i++) {
    if (has(ids[i] as string)) {
      next = ids[i] as string;
      break;
    }
  }
  return { number: at + 1, prev, next };
}