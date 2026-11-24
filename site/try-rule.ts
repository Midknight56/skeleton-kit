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
  | { kind: 'lost'; limit: number; reason: 'exhausted' | 'node_limit' | 'depth_limit'; text: string }
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

function words(action: string): string {
  return action.startsWith('light:') ? `light lantern ${action.slice('light:'.length)}` : action;
}

/** Runs the search on level g03 with the given turn limit. */
export function tryLimit(limit: number): TryResult {
  if (!Number.isInteger(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT) {
    return { kind: 'error', text: `Use a whole number of turns from ${MIN_LIMIT} to ${MAX_LIMIT}.` };
  }
  const def = makeGardenDef(levelsWith(limit)) as unknown as GameDef<Json, unknown>;
  const found = solveTurn(def, LEVEL, 1, { ...turnOptions, maxNodes: NODE_CAP });
  if (!found.solved) {
    const text =
      found.reason === 'exhausted'
        ? `No route wins within ${limit} turns. The search ran out of routes to try.`
        : `The search stopped after ${found.nodes} states, so it cannot say if a route wins within ${limit} turns.`;
    return { kind: 'lost', limit, reason: found.reason, text };
  }
  const session = createSession(def, LEVEL, 1);
  for (const action of found.actions) session.apply(action);
  const hash = session.hash();
  const count = found.actions.length;
  const moves = found.actions.map(words).join(', ');
  const text = `A win within ${limit} turns: ${count} moves. ${moves}. Final state code ${hash}.`;
  return { kind: 'won', limit, actions: found.actions, count, hash, text };
}
