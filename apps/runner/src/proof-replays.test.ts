import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandActions, runReplay, type Replay } from '@kit/core';
import { describe, expect, it } from 'vitest';
import runnerDef from './def';

// The files in proofs/runner/ are written only by `npm run prove`. This test reads them and never writes them.
const proofsDir = fileURLToPath(new URL('../../../proofs/runner/', import.meta.url));
const ids = ['r01', 'r02', 'r03', 'r04', 'r05', 'r06'];

type ProofFile = { game: string; level: string; replay: Replay };
type IndexFile = { game: string; levels: { id: string; actions: number }[] };
const readProof = (dir: string, id: string): ProofFile => JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')) as ProofFile;
const readIndex = (): IndexFile => JSON.parse(readFileSync(join(proofsDir, 'index.json'), 'utf8')) as IndexFile;

describe('proof replays of the runner', () => {
  it('lists r01 to r06 in proofs/runner/index.json', () => {
    const index = readIndex();
    expect(index.game).toBe('runner');
    expect(index.levels.map((level) => level.id)).toEqual(ids);
  });

  it.each(ids)('accepts the replay of %s and ends in phase won', (id) => {
    const proof = readProof(proofsDir, id);
    expect(proof.level).toBe(id);
    const result = runReplay(runnerDef, proof.replay);
    expect(result).toMatchObject({ ok: true, finalPhase: 'won' });
    expect(result.ok && result.finalHash).toBe(proof.replay.finalHash);
  });

  it('has as many actions in each replay as the index says, counted after text*n is expanded', () => {
    for (const level of readIndex().levels) {
      const expanded = expandActions(readProof(proofsDir, level.id).replay.actions);
      expect(expanded.ok && expanded.actions.length, level.id).toBe(level.actions);
    }
  });

  it('refuses a copy with one action removed', () => {
    const folder = mkdtempSync(join(tmpdir(), 'runner-proof-'));
    try {
      copyFileSync(join(proofsDir, 'r01.json'), join(folder, 'r01.json'));
      const copy = readProof(folder, 'r01');
      const expanded = expandActions(copy.replay.actions);
      if (!expanded.ok) throw new Error(expanded.message);
      expanded.actions.splice(2, 1);
      copy.replay.actions = expanded.actions;
      writeFileSync(join(folder, 'r01.json'), JSON.stringify(copy), 'utf8');
      const result = runReplay(runnerDef, readProof(folder, 'r01').replay);
      expect(result.ok).toBe(false);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
