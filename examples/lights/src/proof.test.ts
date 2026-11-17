import { runReplay, createSession } from '@kit/core';
import { solveTurn } from '@kit/solver';
import { describe, expect, it } from 'vitest';
import def from './def';
import { LEVELS } from './levels/levels';
import { turnOptions } from './proof';

describe('the prover on the six levels', () => {
  for (const level of LEVELS) {
    it(`solves ${level.id} in at most ${level.presses.length} actions, and the replay is accepted`, () => {
      const result = solveTurn(def, level.id, 1, turnOptions);
      expect(result.solved, JSON.stringify(result)).toBe(true);
      if (!result.solved) return;
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions.length).toBeLessThanOrEqual(level.presses.length);
      const session = createSession(def, level.id, 1);
      for (const text of result.actions) expect(session.apply(text).ok).toBe(true);
      const check = runReplay(def, session.toReplay());
      expect(check.ok).toBe(true);
      expect(session.status().phase).toBe('won');
    });
  }

  it('keeps only the lamps as the search key', () => {
    const state = def.init('l2', 1);
    expect(turnOptions.key?.({ ...state, moves: 5 })).toEqual(state.lamps);
  });
});
