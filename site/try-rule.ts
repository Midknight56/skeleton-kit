// The turn limit try out of the landing page. It copies garden level g03 in memory with another turn limit,
// runs the turn search of the kit on the copy (the same search and options as the prove command) and says
// in plain words what it found. It reads no file, calls no network and writes no storage.
import { createSession, type GameDef, type Json } from '@kit/core';
import { solveTurn } from '@kit/solver';
import { makeGardenDef } from '../apps/garden/src/def';
import levelsJson from '../apps/garden/src/levels/levels.json';
import { turnOptions } from '../apps/garden/src/proof';
import type { RawLevel } from '../apps/garden/src/rules/level';

export const LEVEL = 'g03';
export const SHIPPED_LIMIT = 8;
export const MIN_LIMIT = 1;
export const MAX_LIMIT = 20;
// The search stops at this many states. Level g03 needs about a dozen, so the cap is far away.
export const NODE_CAP = 20000;

export type TryResult =
  | { kind: 'won'; limit: number; actions: string[]; count: number; hash: string; text: string }
  | { kind: 'lost'; limit: number; reason: 'exhausted' | 'node_limit' | 'depth_limit'; shortest: number | null; text: string }
  | { kind: 'error'; text: string };

/** A whole number from the minimum to the maximum, or null. */
export function readLimit(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= MIN_LIMIT && value <= MAX_LIMIT ? value : null;
}

// The shipped levels are never changed: the copy of g03 is a new object with its own rows.
function levelsWith(limit: number): RawLevel[] {
  return (levelsJson as RawLevel[]).map((level) => (level.id === LEVEL ? { ...level, rows: [...level.rows], maxTurns: limit } : level));
}

function defFor(limit: number): GameDef<Json, unknown> {
  return makeGardenDef(levelsWith(limit)) as unknown as GameDef<Json, unknown>;
}

/** The game definition of the in-memory copy of g03 with this turn limit. Used by the board replay. */
export function copyDef(limit: number): GameDef<Json, unknown> {
  return defFor(limit);
}

function words(action: string): string {
  return action.startsWith('light:') ? `light lantern ${action.slice('light:'.length)}` : action;
}

type Found = ReturnType<typeof solveTurn>;

function search(limit: number, cap: number): Found {
  return solveTurn(defFor(limit), LEVEL, 1, { ...turnOptions, maxNodes: cap });
}

/**
 * The shortest win, derived from real searches and never written down. A relaxed copy (the largest limit)
 * gives a win of n actions. The copy with limit n must be won, and every copy with a limit from 1 to n - 1
 * must end with "exhausted". Any other outcome (a cap reached, no win) gives null.
 */
export function deriveShortest(cap = NODE_CAP): number | null {
  const relaxed = search(MAX_LIMIT, cap);
  if (!relaxed.solved) return null;
  const n = relaxed.actions.length;
  const atN = search(n, cap);
  if (!atN.solved || atN.actions.length !== n) return null;
  for (let lower = MIN_LIMIT; lower < n; lower++) {
    const found = search(lower, cap);
    if (found.solved || found.reason !== 'exhausted') return null;
  }
  return n;
}

/** Runs the search on level g03 with the given turn limit. */
export function tryLimit(limit: number, cap = NODE_CAP): TryResult {
  if (!Number.isInteger(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT) {
    return { kind: 'error', text: `Use a whole number of turns from ${MIN_LIMIT} to ${MAX_LIMIT}.` };
  }
  const def = defFor(limit);
  const found = search(limit, cap);
  if (!found.solved) {
    if (found.reason !== 'exhausted') {
      const text = `Inconclusive: the search stopped after ${found.nodes} states, so it cannot say if a route wins within ${limit} turns. It makes no claim about the shortest win.`;
      return { kind: 'lost', limit, reason: found.reason, shortest: null, text };
    }
    const shortest = deriveShortest(cap);
    const tail =
      shortest === null
        ? ' The search could not confirm the shortest win, so it makes no claim about it.'
        : ` The shortest win needs ${shortest} turns.`;
    const text = `No route wins within ${limit} turns. The search ran out of routes to try: every possible route was exhausted within ${limit} turns.${tail}`;
    return { kind: 'lost', limit, reason: 'exhausted', shortest, text };
  }
  const session = createSession(def, LEVEL, 1);
  for (const action of found.actions) session.apply(action);
  const hash = session.hash();
  const count = found.actions.length;
  const moves = found.actions.map(words).join(', ');
  const text = `A win within ${limit} turns: ${count} moves. ${moves}. Final state code ${hash}.`;
  return { kind: 'won', limit, actions: found.actions, count, hash, text };
}