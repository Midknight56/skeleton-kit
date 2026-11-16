import { createSession, hashState, type GameDef, type Json } from '@kit/core';
import type { SolveResult } from './turn';

export interface TickOptions {
  maxTicks?: number; // default 7200
  maxStatesPerTick?: number; // default 5000
}

interface Entry<S> {
  state: S;
  parent: number; // index in the list of all entries, -1 for the start
  action: string;
}

/**
 * Search for a tick game, one tick at a time. Tick t + 1 is built from tick t in list order and, for each state,
 * in the order of `def.actions`. A lost state is dropped. A state whose hash is already in the new tick is dropped.
 * The search stops right after it adds the first won state. It reads no file and calls no random source.
 */
export function solveTick<S extends Json, A>(def: GameDef<S, A>, levelId: string, seed: number, options: TickOptions = {}): SolveResult {
  const maxTicks = options.maxTicks ?? 7200;
  const maxStatesPerTick = options.maxStatesPerTick ?? 5000;

  const start = createSession(def, levelId, seed).state;
  const all: Entry<S>[] = [{ state: start, parent: -1, action: '' }];
  let nodes = 1;
  if (def.status(start).phase === 'won') return { solved: true, actions: [], nodes };

  const pathTo = (index: number): string[] => {
    const path: string[] = [];
    for (let at = index; all[at]!.parent !== -1; at = all[at]!.parent) path.push(all[at]!.action);
    return path.reverse();
  };

  let layer: number[] = [0];
  for (let tick = 1; tick <= maxTicks; tick++) {
    const next: number[] = [];
    const seen = new Set<string>();
    for (const index of layer) {
      const from = all[index]!.state;
      if (def.status(from).phase !== 'playing') continue;
      for (const action of def.actions(from)) {
        const state = def.step(from, action);
        const phase = def.status(state).phase;
        if (phase === 'lost') continue;
        const hash = hashState(state);
        if (seen.has(hash)) continue;
        seen.add(hash);
        if (next.length >= maxStatesPerTick) return { solved: false, reason: 'node_limit', nodes };
        all.push({ state, parent: index, action: def.encodeAction(action) });
        next.push(all.length - 1);
        nodes += 1;
        if (phase === 'won') return { solved: true, actions: pathTo(all.length - 1), nodes };
      }
    }
    if (next.length === 0) return { solved: false, reason: 'exhausted', nodes };
    layer = next;
  }
  return { solved: false, reason: 'depth_limit', nodes };
}
