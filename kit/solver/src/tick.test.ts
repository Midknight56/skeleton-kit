import { describe, expect, it } from 'vitest';
import { createSession, runReplay } from '@kit/core';
import sampleHop from '../test-fixtures/sample-hop/def';
import noHop from '../test-fixtures/no-hop/def';
import { solveTick } from './tick';

function expectedH1(): string[] {
  return [...new Array<string>(9).fill('none'), 'hop', ...new Array<string>(29).fill('none')];
}

describe('solveTick on the hop sample', () => {
  it('solves h1 with 9 none, one hop and 29 none, and 151 nodes', () => {
    const result = solveTick(sampleHop, 'h1', 1);
    expect(result).toEqual({ solved: true, actions: expectedH1(), nodes: 151 });
    expect(result.solved && result.actions).toHaveLength(39);
  });

  it('gives a list for h1 that passes runReplay with final phase won', () => {
    const result = solveTick(sampleHop, 'h1', 1);
    if (!result.solved) throw new Error('not solved');
    const session = createSession(sampleHop, 'h1', 1);
    for (const text of result.actions) expect(session.apply(text).ok).toBe(true);
    const replay = session.toReplay();
    expect(replay.finalPhase).toBe('won');
    expect(runReplay(sampleHop, replay)).toEqual({ ok: true, finalHash: replay.finalHash, finalPhase: 'won' });
  });

  it('solves h2 in 39 actions and the list wins', () => {
    const result = solveTick(sampleHop, 'h2', 1);
    expect(result.solved && result.actions.length).toBe(39);
    if (!result.solved) return;
    const session = createSession(sampleHop, 'h2', 1);
    for (const text of result.actions) expect(session.apply(text).ok).toBe(true);
    expect(session.status().phase).toBe('won');
  });

  it('is exhausted with 10 nodes on the no-hop copy of h1', () => {
    expect(solveTick(noHop, 'h1', 1)).toEqual({ solved: false, reason: 'exhausted', nodes: 10 });
  });

  it('gives node_limit when maxStatesPerTick is 3, because tick 3 holds 4 states', () => {
    const result = solveTick(sampleHop, 'h1', 1, { maxStatesPerTick: 3 });
    expect(result.solved).toBe(false);
    expect(!result.solved && result.reason).toBe('node_limit');
  });

  it('solves h1 with maxStatesPerTick 4', () => {
    expect(solveTick(sampleHop, 'h1', 1, { maxStatesPerTick: 4 }).solved).toBe(true);
  });

  it('gives depth_limit with maxTicks 38 and solves with maxTicks 39', () => {
    const short = solveTick(sampleHop, 'h1', 1, { maxTicks: 38 });
    expect(short.solved).toBe(false);
    expect(!short.solved && short.reason).toBe('depth_limit');
    expect(solveTick(sampleHop, 'h1', 1, { maxTicks: 39 }).solved).toBe(true);
  });

  it('gives the same answer on every run', () => {
    expect(solveTick(sampleHop, 'h2', 1)).toEqual(solveTick(sampleHop, 'h2', 1));
  });
});
