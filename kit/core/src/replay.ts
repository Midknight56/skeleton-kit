import { expandActions } from './rle';
import { createSession } from './session';
import type { GameDef, Json, Replay, ReplayResult } from './types';

const MAX_SEED = 2147483647;

function fail(error: Extract<ReplayResult, { ok: false }>['error'], message: string, mismatchAt?: number): ReplayResult {
  return mismatchAt === undefined ? { ok: false, error, message } : { ok: false, error, mismatchAt, message };
}

// String() throws on an object without a prototype, so a message is built with this instead.
function show(value: unknown): string {
  try {
    return String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}
/** Runs a replay against a definition. Data from a file never makes it throw. */
export function runReplay<S extends Json, A>(def: GameDef<S, A>, replay: Replay): ReplayResult {
  if (replay.game !== def.id) return fail('wrong_game', `The replay is for "${show(replay.game)}", not "${def.id}".`);
  if (replay.rulesVersion !== def.rulesVersion) {
    return fail('rules_changed', `The replay uses rules version "${show(replay.rulesVersion)}", the game has "${def.rulesVersion}".`);
  }
  if (!def.levels().some((level) => level.id === replay.level)) {
    return fail('unknown_level', `The game has no level "${show(replay.level)}".`);
  }
  if (typeof replay.seed !== 'number' || !Number.isInteger(replay.seed) || replay.seed < 0 || replay.seed > MAX_SEED) {
    return fail('bad_seed', `The seed must be an integer from 0 to ${MAX_SEED}.`);
  }
  if (!Array.isArray(replay.actions) || replay.actions.some((item) => typeof item !== 'string')) {
    return fail('bad_action_text', 'The actions must be a list of text items.');
  }
  const expanded = expandActions(replay.actions);
  if (!expanded.ok) return fail('bad_action_text', expanded.message);

  const session = createSession(def, replay.level, replay.seed);
  for (let i = 0; i < expanded.actions.length; i++) {
    const result = session.apply(expanded.actions[i] as string);
    if (!result.ok) return fail(result.error, result.message, i);
  }
  const finalHash = session.hash();
  const finalPhase = session.status().phase;
  if (finalHash !== replay.finalHash) {
    return fail('hash_mismatch', `The final hash is ${finalHash}, the replay says ${show(replay.finalHash)}.`);
  }
  if (finalPhase !== replay.finalPhase) {
    return fail('phase_mismatch', `The final phase is ${finalPhase}, the replay says ${show(replay.finalPhase)}.`);
  }
  return { ok: true, finalHash, finalPhase };
}
