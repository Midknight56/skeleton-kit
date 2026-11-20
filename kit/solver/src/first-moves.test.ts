import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { GameDef, Json } from '@kit/core';
import sampleLights from '../test-fixtures/sample-lights/def';
import sampleHop from '../test-fixtures/sample-hop/def';
import { countFirstMoves, solveTurn } from './turn';

const LEVELS = ['l1', 'l2', 'l3'] as const;

function counts(level: string, maxDepth: number) {
  const result = countFirstMoves(sampleLights, level, 1, { maxDepth });
  if (!result.decided) throw new Error('undecided');
  return result.firstMoves;
}

/** The same game, but it starts in the state after one first action. Written for the test, apart from countFirstMoves. */
function afterFirst(text: string): GameDef<Json, unknown> {
  const def = sampleLights as unknown as GameDef<Json, unknown>;
  return {
    ...def,
    init: (levelId, seed) => {
      const start = def.init(levelId, seed);
      const action = def.actions(start).find((item) => def.encodeAction(item) === text);
      return def.step(start, action);
    },
  };
}

function firstTexts(level: string): string[] {
  const start = sampleLights.init(level, 1);
  return sampleLights.actions(start).map((action) => sampleLights.encodeAction(action));
}

describe('countFirstMoves on the lights sample', () => {
  it('gives the presses of the solution when maxDepth is the shortest length', () => {
    expect(counts('l1', 1)).toEqual({ legal: 9, winning: 1 });
    expect(counts('l2', 2)).toEqual({ legal: 9, winning: 2 });
    expect(counts('l3', 3)).toEqual({ legal: 9, winning: 3 });
  });

  it('gives 0 and 0 when allow refuses every action', () => {
    expect(countFirstMoves(sampleLights, 'l1', 1, { allow: () => false })).toEqual({ decided: true, firstMoves: { legal: 0, winning: 0 } });
  });

  it('counts only the first actions that allow accepts', () => {
    const result = countFirstMoves(sampleLights, 'l1', 1, { maxDepth: 1, allow: (text) => text === 'press:1,1' || text === 'press:0,0' });
    expect(result).toEqual({ decided: true, firstMoves: { legal: 2, winning: 1 } });
  });

  it('gives 0 and 0 when the start state is already won', () => {
    const won = { ...sampleLights, init: () => ({ lamps: new Array<number>(9).fill(0), moves: 0 }) };
    expect(countFirstMoves(won, 'l1', 1)).toEqual({ decided: true, firstMoves: { legal: 0, winning: 0 } });
  });

  it('is undecided with node_limit and names a first action when maxNodes is 10 on l3', () => {
    const result = countFirstMoves(sampleLights, 'l3', 1, { maxNodes: 10 });
    expect(result.decided).toBe(false);
    if (!result.decided) {
      expect(result.reason).toBe('node_limit');
      expect(firstTexts('l3')).toContain(result.action);
    }
  });

  it('counts two first actions that reach the same state as two', () => {
    const same = { ...sampleLights, step: (state: typeof sampleLights extends GameDef<infer S, unknown> ? S : never) => state };
    const result = countFirstMoves(same as unknown as typeof sampleLights, 'l1', 1, { maxDepth: 1 });
    expect(result).toEqual({ decided: true, firstMoves: { legal: 9, winning: 0 } });
  });

  it('throws a plain Error for a tick game', () => {
    let caught: unknown;
    try {
      countFirstMoves(sampleHop as unknown as GameDef<Json, unknown>, 'h1', 1);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).toBe('Error');
    expect((caught as Error).message.startsWith('countFirstMoves needs a turn game')).toBe(true);
  });

  const levelAndDepth = fc.record({ level: fc.constantFrom(...LEVELS), maxDepth: fc.integer({ min: 1, max: 5 }) });

  it('property 1: winning is at most legal, and at least 1 when solveTurn solves with the same maxDepth', () => {
    fc.assert(
      fc.property(levelAndDepth, ({ level, maxDepth }) => {
        const { legal, winning } = counts(level, maxDepth);
        expect(winning).toBeLessThanOrEqual(legal);
        if (solveTurn(sampleLights, level, 1, { maxDepth }).solved) expect(winning).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 15 },
    );
  });

  it('property 2: the first action of the solveTurn result is a winning first move, and winning matches a count made apart', () => {
    fc.assert(
      fc.property(levelAndDepth, ({ level, maxDepth }) => {
        const winners = firstTexts(level).filter((text) => solveTurn(afterFirst(text), level, 1, { maxDepth: maxDepth - 1 }).solved);
        expect(counts(level, maxDepth).winning).toBe(winners.length);
        const solved = solveTurn(sampleLights, level, 1, { maxDepth });
        if (solved.solved) expect(winners).toContain(solved.actions[0]);
      }),
      { numRuns: 15 },
    );
  });

  it('property 3: two calls with the same input give equal results', () => {
    fc.assert(
      fc.property(levelAndDepth, ({ level, maxDepth }) => {
        expect(countFirstMoves(sampleLights, level, 1, { maxDepth })).toEqual(countFirstMoves(sampleLights, level, 1, { maxDepth }));
      }),
      { numRuns: 15 },
    );
  });
});
