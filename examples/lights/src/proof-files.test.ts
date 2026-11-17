import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expandActions, runReplay, type Replay } from '@kit/core';
import { solveTurn } from '@kit/solver';
import { describe, expect, it } from 'vitest';
import def from './def';
import { turnOptions } from './proof';

// The proof files in examples/lights/proofs are a copy of what `npm run prove` wrote in the copy of the
// repository where this game was made. The test shows that they still hold for this code.
const read = (name: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(`../proofs/${name}.json`, import.meta.url)), 'utf8'));

interface ProofFile { game: string; level: string; replay: Replay & { actions: string[] }; stats: { actions: number } }

describe('the proof files of the example', () => {
  const index = read('index') as { game: string; levels: { id: string; actions: number }[] };

  it('list the six levels of the game', () => {
    expect(index.game).toBe('lights');
    expect(index.levels.map((l) => l.id)).toEqual(def.levels().map((l) => l.id));
  });

  for (const level of def.levels()) {
    it(`for ${level.id}: the replay is accepted, wins, and is what the search finds now`, () => {
      const proof = read(level.id) as ProofFile;
      expect(proof.game).toBe('lights');
      expect(proof.level).toBe(level.id);
      const check = runReplay(def, proof.replay);
      expect(check.ok).toBe(true);
      const expanded = expandActions(proof.replay.actions);
      expect(expanded.ok).toBe(true);
      const fresh = solveTurn(def, level.id, 1, turnOptions);
      expect(fresh.solved).toBe(true);
      if (expanded.ok && fresh.solved) expect(expanded.actions).toEqual(fresh.actions);
      expect(index.levels.find((l) => l.id === level.id)?.actions).toBe(proof.stats.actions);
    });
  }
});
