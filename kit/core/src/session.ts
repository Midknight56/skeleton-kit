import { KitError } from './errors';
import { hashState } from './hash';
import { compressActions } from './rle';
import type { ApplyResult, GameDef, Json, Replay, Session, Status } from './types';

const MAX_SEED = 2147483647;
const MAX_HISTORY = 500;

/** Starts a session on one level. Throws `KitError` only for an unknown level or a bad seed. */
export function createSession<S extends Json, A>(def: GameDef<S, A>, levelId: string, seed: number): Session<S, A> {
  if (!def.levels().some((level) => level.id === levelId)) {
    throw new KitError('unknown_level', `Unknown level "${levelId}"`);
  }
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
    throw new KitError('bad_seed', `The seed must be an integer from 0 to ${MAX_SEED}`);
  }

  let state = def.init(levelId, seed);
  let tick = 0;
  const history: S[] = [];
  const log: string[] = [];

  const session: Session<S, A> = {
    def,
    level: levelId,
    seed,
    get state() {
      return state;
    },
    get tick() {
      return tick;
    },
    legal() {
      return def.actions(state).map((action) => def.encodeAction(action));
    },
    apply(actionText: string): ApplyResult {
      if (def.status(state).phase !== 'playing') {
        return { ok: false, error: 'game_over', message: 'The game has ended.' };
      }
      const action = def.decodeAction(actionText);
      if (action === null) {
        return { ok: false, error: 'bad_action_text', message: `The text "${actionText}" is not an action of this game.` };
      }
      const text = def.encodeAction(action);
      if (!def.actions(state).some((listed) => def.encodeAction(listed) === text)) {
        return { ok: false, error: 'illegal_action', message: `The action "${text}" is not legal now.` };
      }
      const next = def.step(state, action);
      if (def.kind === 'turn') {
        history.push(state);
        if (history.length > MAX_HISTORY) history.shift();
      }
      state = next;
      tick += 1;
      log.push(text);
      return { ok: true, hash: hashState(state), status: def.status(state) };
    },
    undo() {
      if (def.kind !== 'turn') return false;
      const earlier = history.pop();
      if (earlier === undefined) return false;
      state = earlier;
      tick -= 1;
      log.pop();
      return true;
    },
    status(): Status {
      return def.status(state);
    },
    hash() {
      return hashState(state);
    },
    toReplay(): Replay {
      return {
        format: 1,
        game: def.id,
        rulesVersion: def.rulesVersion,
        level: levelId,
        seed,
        actions: compressActions(log),
        finalHash: hashState(state),
        finalPhase: def.status(state).phase,
      };
    },
  };
  return session;
}
