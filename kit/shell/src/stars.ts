import type { Json } from '@kit/core';
import type { ProgressStore } from './storage';
import type { GameTexts } from './types';

// 3 stars at par or better, 2 stars within 2 actions of par, 1 star otherwise.
export function turnStars(actions: number, par: number): 1 | 2 | 3 {
  if (actions <= par) return 3;
  if (actions <= par + 2) return 2;
  return 1;
}

export interface StarsInput<S extends Json> {
  kind: 'turn' | 'tick';
  texts: GameTexts<S>;
  start: S | null;
  end: S | null;
  // The actions used, which is session.tick.
  actions: number;
  // The `actions` of the level in the proof index, or undefined when the proof did not load.
  par: number | undefined;
}

// Stars of a won level. A turn level whose par is unknown gives 1 star, and a later win with
// the par known can raise it, because stored stars only rise.
export function starsFor<S extends Json>(input: StarsInput<S>): 1 | 2 | 3 {
  if (input.kind === 'turn') return input.par === undefined ? 1 : turnStars(input.actions, input.par);
  if (!input.texts.tickStars) throw new Error('A tick game needs a tickStars function in its texts.');
  if (input.start === null || input.end === null) throw new Error('A tick game needs the start state and the end state.');
  return input.texts.tickStars(input.start, input.end);
}

// Saves the result of a won level. `best` is the fewest actions of a turn level and the score of a tick level.
export function finishLevel(store: ProgressStore, kind: 'turn' | 'tick', levelId: string, stars: number, best: number): void {
  store.recordResult(levelId, { stars, best }, kind);
}
