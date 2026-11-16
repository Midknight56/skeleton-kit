import { describe, expect, it } from 'vitest';
import { createSession, runReplay } from '@kit/core';
import sampleLights from '../test-fixtures/sample-lights/def';
import { solveTurn } from './turn';

const LEVELS = ['l1', 'l2', 'l3'] as const;

/** A slow search written for the test: tries every action list of length 1, then 2, then 3, in the order of def.actions. */
function referenceLength(level: string): number | null {
  const all = sampleLights.actions(sampleLights.init(level, 1)).map((action) => sampleLights.encodeAction(action));
  function tryAll(prefix: string[], length: number): boolean {
    if (prefix.length === length) {
      const session = createSession(sampleLights, level, 1);
      for (const text of prefix) {
        if (!session.apply(text).ok) return false;
      }
      return session.status().phase === 'won';
    }
    return all.some((text) => tryAll([...prefix, text], length));
  }
  for (let length = 1; length <= 3; length++) {
    if (tryAll([], length)) return length;
  }
  return null;
}

describe('solveTurn on the lights sample', () => {
  it('gives the same shortest length as the slow reference search', () => {
    const lengths = LEVELS.map((level) => {
      const result = solveTurn(sampleLights, level, 1);
      expect(result.solved).toBe(true);
      return result.solved ? result.actions.length : -1;
    });
    expect(lengths).toEqual([1, 2, 3]);
    expect(LEVELS.map((level) => referenceLength(level))).toEqual([1, 2, 3]);
  });

  it('returns the first shortest list in the order of def.actions', () => {
    const expected: Record<string, string[]> = {
      l1: ['press:1,1'],
      l2: ['press:0,0', 'press:2,2'],
      l3: ['press:1,0', 'press:0,1', 'press:2,2'],
    };
    for (const level of LEVELS) {
      const result = solveTurn(sampleLights, level, 1);
      expect(result.solved && result.actions).toEqual(expected[level]);
    }
  });

  it('gives a list that passes runReplay with final phase won', () => {
    for (const level of LEVELS) {
      const result = solveTurn(sampleLights, level, 1);
      if (!result.solved) throw new Error('not solved');
      const session = createSession(sampleLights, level, 1);
      for (const text of result.actions) expect(session.apply(text).ok).toBe(true);
      const replay = session.toReplay();
      expect(replay.finalPhase).toBe('won');
      expect(runReplay(sampleLights, replay)).toEqual({ ok: true, finalHash: replay.finalHash, finalPhase: 'won' });
    }
  });

  it('counts the start state in nodes', () => {
    const result = solveTurn(sampleLights, 'l1', 1);
    expect(result.nodes).toBeGreaterThanOrEqual(2);
  });

  it('returns an empty list when the start state is already won', () => {
    const won = { ...sampleLights, init: () => ({ lamps: new Array<number>(9).fill(0), moves: 0 }) };
    expect(solveTurn(won, 'l1', 1)).toEqual({ solved: true, actions: [], nodes: 1 });
  });

  it('is exhausted with one node when allow refuses every action', () => {
    expect(solveTurn(sampleLights, 'l1', 1, { allow: () => false })).toEqual({ solved: false, reason: 'exhausted', nodes: 1 });
  });

  it('uses only the actions that allow accepts', () => {
    // The press matrix is invertible over GF(2), so l1 has one press set. Refusing its press makes l1 unsolvable.
    const refused = solveTurn(sampleLights, 'l1', 1, { allow: (text) => text !== 'press:1,1' });
    expect(refused.solved).toBe(false);
    const only = solveTurn(sampleLights, 'l1', 1, { allow: (text) => text === 'press:1,1' });
    expect(only.solved && only.actions).toEqual(['press:1,1']);
  });

  it('solves l3 in 3 actions with at most 512 nodes when the key is the lamps only', () => {
    const result = solveTurn(sampleLights, 'l3', 1, { key: (state) => (state as { lamps: number[] }).lamps });
    expect(result.solved && result.actions.length).toBe(3);
    expect(result.nodes).toBeLessThanOrEqual(512);
  });

  it('gives depth_limit when maxDepth 2 is too small for l3, and still solves l1 with maxDepth 1', () => {
    const limited = solveTurn(sampleLights, 'l3', 1, { maxDepth: 2 });
    expect(limited.solved).toBe(false);
    expect(!limited.solved && limited.reason).toBe('depth_limit');
    expect(solveTurn(sampleLights, 'l1', 1, { maxDepth: 1 }).solved).toBe(true);
  });

  it('gives node_limit when maxNodes 10 is too small for l3', () => {
    const limited = solveTurn(sampleLights, 'l3', 1, { maxNodes: 10 });
    expect(limited.solved).toBe(false);
    expect(!limited.solved && limited.reason).toBe('node_limit');
  });

  it('gives the same answer on every run', () => {
    expect(solveTurn(sampleLights, 'l3', 1)).toEqual(solveTurn(sampleLights, 'l3', 1));
  });
});
