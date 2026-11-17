import { runConformance } from '@kit/conformance';
import { createSession, randomInt, validateDef, type GameDef, type Json } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../game.config';
import runnerDef, { makeRunnerDef } from './def';
import { fixtureA, fixtureB, fixtureC, fixtureD1, fixtureD2, fixtureE, fixtureF, fixtureG } from './rules/fixtures';
import type { RunnerState } from './rules/state';
import type { RunnerAction } from './rules/step';
import courses from './levels/courses.json';

type Def = GameDef<RunnerState, RunnerAction>;

const failing = (def: Def): string[] =>
  runConformance(def)
    .filter((result) => !result.passed)
    .map((result) => `${result.name}: ${result.message ?? ''}`);

describe('runner definition', () => {
  it('has the id, kind, rules version, tick rate and the title from game.config.ts', () => {
    expect(runnerDef.id).toBe('runner');
    expect(runnerDef.kind).toBe('tick');
    expect(runnerDef.ticksPerSecond).toBe(60);
    expect(runnerDef.rulesVersion).toBe('1');
    expect(runnerDef.title).toBe(gameConfig.title);
  });

  it('is a valid definition', () => {
    expect(validateDef(runnerDef as unknown as GameDef<Json, unknown>)).toEqual([]);
  });

  it('lists the courses of courses.json in file order with id and title', () => {
    expect(runnerDef.levels()).toEqual(courses.map((course) => ({ id: course.id, title: course.title })));
    expect(makeRunnerDef([fixtureB, fixtureA]).levels()).toEqual([
      { id: 'fb', title: 'Pumpkin' },
      { id: 'fa', title: 'Flat' },
    ]);
  });

  it('ignores the seed in init', () => {
    const def = makeRunnerDef([fixtureD1]);
    expect(def.init('fd1', 1)).toEqual(def.init('fd1', 99999));
  });

  it('throws a plain Error that names the course and its problems for a bad course', () => {
    const def = makeRunnerDef([{ id: 'bad', title: 'Bad', air2: '..', air1: '..', ground: '__' }]);
    expect(() => def.init('bad', 1)).toThrow(/bad.*columns/s);
  });

  it('parses every shipped course', () => {
    for (const course of courses) expect(() => runnerDef.init(course.id, 1), course.id).not.toThrow();
  });
});

describe('runner conformance', () => {
  it('passes runConformance for the default definition', () => {
    expect(failing(runnerDef)).toEqual([]);
  });

  it.each([
    ['A', fixtureA],
    ['B', fixtureB],
    ['C', fixtureC],
    ['D, candle low', fixtureD1],
    ['D, candle high', fixtureD2],
    ['E', fixtureE],
    ['F', fixtureF],
    ['G', fixtureG],
  ])('passes runConformance for fixture %s', (_name, raw) => {
    expect(failing(makeRunnerDef([raw]))).toEqual([]);
  });
});

describe('runner extra properties', () => {
  const def = makeRunnerDef([fixtureA, fixtureB, fixtureC, fixtureD1, fixtureD2, fixtureE, fixtureF, fixtureG]);
  const integers = (state: RunnerState): number[] => [state.x, state.feetY, state.vy, state.tick, state.score, ...state.candles];

  /** Random legal runs. Jumps are picked about one time in five. */
  function runs(visit: (before: RunnerState, after: RunnerState, where: string) => void): void {
    let rng = 77;
    const draw = (n: number): number => {
      const out = randomInt(rng, n);
      rng = out.state;
      return out.value;
    };
    const ids = def.levels().map((level) => level.id);
    for (let run = 0; run < 160; run++) {
      const id = ids[run % ids.length]!;
      const session = createSession(def, id, 1);
      for (let i = 0; i < 560; i++) {
        const legal = session.legal();
        if (legal.length === 0) break;
        const text = legal.includes('jump') && draw(5) === 0 ? 'jump' : 'none';
        const before = session.state;
        expect(session.apply(text).ok).toBe(true);
        visit(before, session.state, `${id} run ${run} action ${i}`);
      }
    }
  }

  it('keeps x at 44 times the tick (property 1)', () => {
    runs((_before, after, where) => expect(after.x, where).toBe(44 * after.tick));
  });

  it('never puts the feet under the ground (property 2)', () => {
    runs((_before, after, where) => expect(after.feetY, where).toBeLessThanOrEqual(0));
  });

  it('sets onGround exactly when feetY and vy are 0 (property 3)', () => {
    runs((_before, after, where) => expect(after.onGround, where).toBe(after.feetY === 0 && after.vy === 0));
  });

  it('never lowers the score (property 4)', () => {
    runs((before, after, where) => expect(after.score, where).toBeGreaterThanOrEqual(before.score));
  });

  it('keeps every number an integer (property 7)', () => {
    runs((_before, after, where) => {
      for (const value of integers(after)) expect(Number.isInteger(value), where).toBe(true);
    });
  });

  it('gives the same hash for an action that is not legal (property 8)', () => {
    const session = createSession(def, 'fc', 1);
    session.apply('jump');
    const before = session.hash();
    expect(session.apply('jump').ok).toBe(false);
    expect(session.hash()).toBe(before);
  });

  it('lands a jump on tick 33 with x grown by 1452 when nothing lies 4 tiles ahead (property 5)', () => {
    let checked = 0;
    runs((before) => {
      if (before.phase !== 'playing' || !before.onGround) return;
      const first = Math.floor(before.x / 512);
      const last = Math.floor((before.x + 320 + 4 * 512 - 1) / 512);
      const clear = before.ground.slice(first, last + 1) === '_'.repeat(last - first + 1) && last < before.ground.length;
      if (!clear) return;
      let state = before;
      for (let k = 1; k <= 33; k++) {
        state = def.step(state, k === 1 ? 'jump' : 'none');
        expect(state.phase, `tick ${k} of the jump from x ${before.x}`).toBe('playing');
        expect(state.onGround, `tick ${k} of the jump from x ${before.x}`).toBe(k === 33);
      }
      expect(state.feetY).toBe(0);
      expect(state.x - before.x).toBe(1452);
      checked++;
    });
    expect(checked).toBeGreaterThan(50);
  });
});
