import type { GameDef, Json } from '@kit/core';
import { solveTick, type SolveResult } from '@kit/solver';
import { solveTurn } from '@kit/solver';
import { describe, expect, it } from 'vitest';
import { makeRunnerDef } from './def';
import { levelChecks, levelPlans, obstacleWindows, runChecks, type CheckPlan } from './proof';
import { fixtureB, fixtureE, fixtureF, fixtureG } from './rules/fixtures';
import type { RawCourse, RunnerState } from './rules/state';
import { step } from './rules/step';

const tools = { solveTurn, solveTick };
const dots = '.'.repeat(40);

/** A course of 40 columns with the given ground row. */
const course = (ground: string, id = 'x'): RawCourse => ({ id, title: 'Test', air2: dots, air1: dots, ground });
const ground = (columns: Record<number, string>): string => {
  const chars = Array.from(`${'_'.repeat(39)}G`);
  for (const [column, char] of Object.entries(columns)) chars[Number(column)] = char;
  return chars.join('');
};

const asDef = (raw: RawCourse): GameDef<Json, unknown> => makeRunnerDef([raw]) as unknown as GameDef<Json, unknown>;

function solve(def: GameDef<Json, unknown>, id: string): SolveResult {
  return solveTick(def, id, 1);
}

/** The window by a brute force loop of plain `step` calls: jump at tick t, run on, and see if the run survives. */
function bruteForce(raw: RawCourse, right: number): number {
  const parsedStart = makeRunnerDef([raw]).init(raw.id, 1);
  let good = 0;
  let walker: RunnerState = parsedStart;
  while (walker.phase === 'playing' && walker.onGround) {
    let state = step(walker, 'jump');
    while (state.phase === 'playing' && !(state.onGround && state.x >= right)) state = step(state, 'none');
    for (let i = 0; i < 10 && state.phase === 'playing'; i++) state = step(state, 'none');
    if (state.phase === 'playing' || state.phase === 'won') good++;
    walker = step(walker, 'none');
  }
  return good;
}

const plan = (length: number, obstacles: number, minWindow: number): CheckPlan => ({ length, obstacles, minWindow });

describe('jump windows', () => {
  // Fixtures B, E, F and G each hold one obstacle at column 10, so its right edge is at the end of column 10 or 11.
  it.each([
    ['B, pumpkin', fixtureB, 11 * 512, 7],
    ['E, gap of 1 column', fixtureE, 11 * 512, 21],
    ['F, gap of 2 columns', fixtureF, 12 * 512, 10],
    ['G, post', fixtureG, 11 * 512, 5],
  ])('gives the brute force count and the hand value for %s', (_name, raw, right, hand) => {
    const def = asDef(raw);
    const solved = solve(def, raw.id);
    if (!solved.solved) throw new Error('the fixture is not solved');
    const windows = obstacleWindows(def, raw.id, solved.actions);
    expect(windows).toHaveLength(1);
    expect(windows[0]!.window).toBe(bruteForce(raw, right));
    expect(windows[0]!.window).toBe(hand);
    expect(windows[0]!.split).toBe(false);
  });

  it('gives the good jump ticks of the design table for the pumpkin and the post', () => {
    for (const [raw, first, last] of [
      [fixtureB, 99, 105],
      [fixtureG, 100, 104],
      [fixtureE, 92, 112],
      [fixtureF, 103, 112],
    ] as const) {
      const def = asDef(raw);
      const solved = solve(def, raw.id);
      if (!solved.solved) throw new Error('the fixture is not solved');
      const [window] = obstacleWindows(def, raw.id, solved.actions);
      expect([window!.goodTicks[0], window!.goodTicks.at(-1)], raw.id).toEqual([first, last]);
    }
  });

  it('reports a split window with the detail "window is split"', () => {
    // A definition with a hole: a jump taken at tick 102 is lost. The good ticks 99 to 105 become two groups.
    const real = asDef(fixtureB);
    const holed: GameDef<Json, unknown> = {
      ...real,
      step: (state, action) => {
        const s = state as unknown as RunnerState;
        return action === 'jump' && s.tick === 102 ? ({ ...s, phase: 'lost', reason: 'hit' } as unknown as Json) : real.step(state, action);
      },
    };
    const solved = solve(real, 'fb');
    const [window] = obstacleWindows(holed, 'fb', solved.solved ? solved.actions : []);
    expect(window!.window).toBe(6);
    expect(window!.split).toBe(true);
    const checks = runChecks(holed, 'fb', solved, tools, plan(40, 1, 4));
    const windowCheck = checks.find((check) => check.name === 'window_ok');
    expect(windowCheck?.passed).toBe(false);
    expect(windowCheck?.detail).toContain('window is split');
  });
});

describe('runChecks', () => {
  const names = (checks: { name: string }[]): string[] => checks.map((check) => check.name);

  it('passes every check for a pumpkin with 4 plain columns on each side', () => {
    const raw = course(ground({ 10: 'p' }));
    const def = asDef(raw);
    const checks = runChecks(def, 'x', solve(def, 'x'), tools, plan(40, 1, 6));
    expect(names(checks)).toEqual(['length_ok', 'finishable', 'spacing_ok', 'window_ok']);
    expect(checks.filter((check) => !check.passed)).toEqual([]);
  });

  it('fails window_ok when the plan asks for more than the window', () => {
    const raw = course(ground({ 10: 'p' }));
    const def = asDef(raw);
    const checks = runChecks(def, 'x', solve(def, 'x'), tools, plan(40, 1, 8));
    expect(checks.find((check) => check.name === 'window_ok')).toMatchObject({ passed: false });
    expect(checks.find((check) => check.name === 'window_ok')?.detail).toMatch(/window 7, the plan needs 8/);
  });

  it('fails spacing_ok for pumpkins in columns 10 and 13 (2 plain columns between)', () => {
    const raw = course(ground({ 10: 'p', 13: 'p' }));
    const def = asDef(raw);
    const checks = runChecks(def, 'x', solve(def, 'x'), tools, plan(40, 2, 1));
    expect(checks.find((check) => check.name === 'spacing_ok')).toMatchObject({ passed: false });
  });

  it('fails spacing_ok for an obstacle 3 plain columns before the gate, and passes with 4', () => {
    for (const [column, passed] of [
      [35, false],
      [34, true],
    ] as const) {
      const raw = course(ground({ 10: 'p', [column]: 'p' }));
      const def = asDef(raw);
      const checks = runChecks(def, 'x', solve(def, 'x'), tools, plan(40, 2, 1));
      expect(checks.find((check) => check.name === 'spacing_ok')?.passed, `column ${column + 1}`).toBe(passed);
    }
  });

  it('finds a gap of 2 columns and a post right after it exhausted and not finishable', () => {
    const raw = course(ground({ 10: '.', 11: '.', 12: 'P' }));
    const def = asDef(raw);
    const solved = solve(def, 'x');
    expect(solved).toMatchObject({ solved: false, reason: 'exhausted' });
    const checks = runChecks(def, 'x', solved, tools, plan(40, 1, 1));
    expect(checks.find((check) => check.name === 'finishable')).toMatchObject({ passed: false });
    expect(names(checks)).not.toContain('window_ok');
  });

  it('fails length_ok for a course of the wrong length and for the wrong number of obstacles', () => {
    const def = asDef(course(ground({ 10: 'p' })));
    const solved = solve(def, 'x');
    expect(runChecks(def, 'x', solved, tools, plan(60, 1, 1)).find((check) => check.name === 'length_ok')).toMatchObject({ passed: false });
    expect(runChecks(def, 'x', solved, tools, plan(40, 2, 1)).find((check) => check.name === 'length_ok')).toMatchObject({ passed: false });
    expect(runChecks(def, 'x', solved, tools, plan(40, 1, 1)).find((check) => check.name === 'length_ok')).toMatchObject({ passed: true });
  });

  it('reports a course that does not parse as a failed length_ok and does not throw', () => {
    const def = asDef({ id: 'bad', title: 'Bad', air2: '..', air1: '..', ground: '__' });
    const checks = runChecks(def, 'bad', { solved: false, reason: 'exhausted', nodes: 0 }, tools, plan(40, 1, 1));
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ name: 'length_ok', passed: false });
  });
});

describe('levelChecks and levelPlans', () => {
  it('holds the plans of the design', () => {
    expect(levelPlans).toEqual({
      r01: plan(60, 3, 9),
      r02: plan(80, 5, 9),
      r03: plan(100, 7, 6),
      r04: plan(120, 9, 6),
      r05: plan(140, 11, 4),
      r06: plan(160, 13, 4),
    });
  });

  it('reports a failed length_ok for an id that has no plan', () => {
    const def = asDef(course(ground({ 10: 'p' }), 'zz'));
    const checks = levelChecks(def, 'zz', solve(def, 'zz'), tools);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ name: 'length_ok', passed: false });
    expect(checks[0]!.detail).toContain('zz');
  });
});
