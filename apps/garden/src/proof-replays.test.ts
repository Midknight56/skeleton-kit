import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandActions, runReplay, type Replay } from '@kit/core';
import { describe, expect, it } from 'vitest';
import gardenDef from './def';

// The files in proofs/garden/ are written only by `npm run prove`. This test reads them and never writes them.
const proofsDir = fileURLToPath(new URL('../../../proofs/garden/', import.meta.url));
const ids = Array.from({ length: 12 }, (_, i) => `g${String(i + 1).padStart(2, '0')}`);

type ProofFile = { game: string; level: string; replay: Replay };
const readProof = (dir: string, id: string): ProofFile => JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')) as ProofFile;

describe('proof replays of the garden puzzle', () => {
  it('lists g01 to g12 in proofs/garden/index.json', () => {
    const index = JSON.parse(readFileSync(join(proofsDir, 'index.json'), 'utf8')) as { game: string; levels: { id: string; actions: number }[] };
    expect(index.game).toBe('garden');
    expect(index.levels.map((level) => level.id)).toEqual(ids);
  });

  it.each(ids)('accepts the replay of %s and ends in phase won', (id) => {
    const proof = readProof(proofsDir, id);
    expect(proof.level).toBe(id);
    const result = runReplay(gardenDef, proof.replay);
    expect(result).toMatchObject({ ok: true, finalPhase: 'won' });
    expect(result.ok && result.finalHash).toBe(proof.replay.finalHash);
  });

  it('has as many actions in each replay as the index says, counted after 	ext*n is expanded', () => {
    const index = JSON.parse(readFileSync(join(proofsDir, 'index.json'), 'utf8')) as { levels: { id: string; actions: number }[] };
    for (const level of index.levels) {
      const expanded = expandActions(readProof(proofsDir, level.id).replay.actions);
      expect(expanded.ok && expanded.actions.length, level.id).toBe(level.actions);
    }
  });

  it('refuses a copy with one action removed', () => {
    const folder = mkdtempSync(join(tmpdir(), 'garden-proof-'));
    try {
      copyFileSync(join(proofsDir, 'g05.json'), join(folder, 'g05.json'));
      const copy = readProof(folder, 'g05');
      const expanded = expandActions(copy.replay.actions);
      if (!expanded.ok) throw new Error(expanded.message);
      expanded.actions.splice(2, 1);
      copy.replay.actions = expanded.actions;
      writeFileSync(join(folder, 'g05.json'), JSON.stringify(copy), 'utf8');
      const result = runReplay(gardenDef, readProof(folder, 'g05').replay);
      expect(result.ok).toBe(false);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
