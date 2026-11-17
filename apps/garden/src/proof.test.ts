import { solveTick, solveTurn, type SolveResult } from '@kit/solver';
import type { GameDef, Json } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { makeGardenDef } from './def';
import { levelChecks, levelPlans, runChecks, turnOptions, type CheckPlan } from './proof';
import { fixtureA, fixtureB, fixtureD } from './rules/fixtures';
import type { RawLevel } from './rules/level';

const tools = { solveTurn, solveTick };

function build(raw: RawLevel): GameDef<Json, unknown> {
  return makeGardenDef([raw]) as unknown as GameDef<Json, unknown>;
}

function solve(raw: RawLevel): { def: GameDef<Json, unknown>; result: SolveResult } {
  const def = build(raw);
  return { def, result: solveTurn(def, raw.id, 1, turnOptions) };
}

const byName = (list: { name: string; passed: boolean }[]): Record<string, boolean> =>
  Object.fromEntries(list.map((item) => [item.name, item.passed]));

describe('turnOptions', () => {
  it('keeps the lit lantern and the moths in the key, and not the turn', () => {
    const def = build(fixtureA);
    const a = def.init('fa', 1) as { turn: number };
    const b = { ...a, turn: 5 };
    expect(turnOptions.key!(a as Json)).toEqual(turnOptions.key!(b as Json));
    expect(turnOptions.key!(a as Json)).toHaveProperty('lit');
    expect(turnOptions.key!(a as Json)).toHaveProperty('moths');
    expect(turnOptions.maxDepth).toBe(40);
  });
});

describe('solveTurn on the fixtures', () => {
  it('solves fixture A in two actions', () => {
    const { result } = solve(fixtureA);
    expect(result.solved).toBe(true);
    expect(result.solved && result.actions).toEqual(['light:1', 'wait']);
  });

  it('does not solve fixture B, the search is exhausted', () => {
    const { result } = solve(fixtureB);
    expect(result).toMatchObject({ solved: false, reason: 'exhausted' });
  });

  it('solves fixture D with exactly four actions', () => {
    const { result } = solve(fixtureD);
    expect(result.solved && result.actions).toEqual(['light:1', 'light:2', 'wait', 'wait']);
  });
});

describe('runChecks', () => {
  it('passes size_ok and fails needs_switch for fixture A', () => {
    const { def, result } = solve(fixtureA);
    const plan: CheckPlan = { moths: 1, band: [2, 2], needsSwitch: true, webMatters: false };
    const checks = runChecks(def, 'fa', result, tools, plan);
    const named = byName(checks);
    expect(named.size_ok).toBe(true);
    expect(named.needs_switch).toBe(false);
    expect(named.length_in_band).toBe(true);
    expect(checks.map((check) => check.name)).not.toContain('web_matters');
  });

  it('passes every check for fixture D with its plan', () => {
    const { def, result } = solve(fixtureD);
    const plan: CheckPlan = { moths: 1, band: [4, 4], needsSwitch: true, webMatters: true };
    const checks = runChecks(def, 'fd', result, tools, plan);
    expect(checks.map((check) => check.name)).toEqual(['size_ok', 'length_in_band', 'turn_limit', 'needs_switch', 'web_matters']);
    expect(checks.filter((check) => !check.passed)).toEqual([]);
    expect(fixtureD.maxTurns).toBe(4 + 4);
  });

  it('fails turn_limit when maxTurns is not the length plus 4', () => {
    const { def, result } = solve(fixtureA);
    const plan: CheckPlan = { moths: 1, band: [2, 2], needsSwitch: false, webMatters: false };
    expect(byName(runChecks(def, 'fa', result, tools, plan)).turn_limit).toBe(false);
  });

  it('fails length_in_band outside the band, and size_ok for the wrong moth count', () => {
    const { def, result } = solve(fixtureD);
    const plan: CheckPlan = { moths: 2, band: [5, 8], needsSwitch: false, webMatters: false };
    const named = byName(runChecks(def, 'fd', result, tools, plan));
    expect(named.length_in_band).toBe(false);
    expect(named.size_ok).toBe(false);
  });

  it('fails size_ok, and does not throw, for a board that is too wide', () => {
    const wide = build({ id: 'wd', title: 'Wide', maxTurns: 9, rows: ['m.f......1'] });
    const plan: CheckPlan = { moths: 1, band: null, needsSwitch: false, webMatters: false };
    const result: SolveResult = { solved: true, actions: ['light:1'], nodes: 1 };
    let checks: { name: string; passed: boolean }[] = [];
    expect(() => {
      checks = runChecks(wide, 'wd', result, tools, plan);
    }).not.toThrow();
    expect(byName(checks).size_ok).toBe(false);
  });

  it('fails size_ok for a level with 5 lanterns', () => {
    const five = build({ id: 'fv', title: 'Five', maxTurns: 9, rows: ['m.f12345'] });
    const plan: CheckPlan = { moths: 1, band: null, needsSwitch: false, webMatters: false };
    const result: SolveResult = { solved: true, actions: ['light:1'], nodes: 1 };
    expect(byName(runChecks(five, 'fv', result, tools, plan)).size_ok).toBe(false);
  });
  it('fails web_matters when no lantern leads the moth into a web', () => {
    const { def, result } = solve(fixtureA);
    const plan: CheckPlan = { moths: 1, band: null, needsSwitch: false, webMatters: true };
    expect(byName(runChecks(def, 'fa', result, tools, plan)).web_matters).toBe(false);
  });
});

describe('levelChecks', () => {
  it('has a plan for g01 to g12 from the band table', () => {
    expect(Object.keys(levelPlans)).toEqual(Array.from({ length: 12 }, (_, i) => `g${String(i + 1).padStart(2, '0')}`));
    expect(levelPlans.g01).toEqual({ moths: 1, band: [2, 3], needsSwitch: false, webMatters: false });
    expect(levelPlans.g02).toEqual({ moths: 1, band: [3, 4], needsSwitch: false, webMatters: false });
    expect(levelPlans.g03).toEqual({ moths: 1, band: [4, 6], needsSwitch: true, webMatters: false });
    expect(levelPlans.g04).toEqual({ moths: 2, band: [5, 8], needsSwitch: true, webMatters: true });
    expect(levelPlans.g05).toEqual({ moths: 2, band: [5, 8], needsSwitch: true, webMatters: true });
    for (const id of ['g06', 'g07', 'g08']) expect(levelPlans[id]).toEqual({ moths: 2, band: [6, 11], needsSwitch: true, webMatters: true });
    for (const id of ['g09', 'g10']) expect(levelPlans[id]).toEqual({ moths: 3, band: [9, 13], needsSwitch: true, webMatters: true });
    for (const id of ['g11', 'g12']) expect(levelPlans[id]).toEqual({ moths: 3, band: [11, 16], needsSwitch: true, webMatters: true });
  });

  it('returns one failed check for an id without a plan', () => {
    const { def, result } = solve(fixtureA);
    const checks = levelChecks(def, 'fa', result, tools);
    expect(checks).toHaveLength(1);
    expect(checks[0]!.passed).toBe(false);
  });

  it('returns one failed length_in_band check when the level is not solved', () => {
    const def = makeGardenDef([{ ...fixtureB, id: 'g04' }]) as unknown as GameDef<Json, unknown>;
    const result = solveTurn(def, 'g04', 1, turnOptions);
    const checks = levelChecks(def, 'g04', result, tools);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ name: 'length_in_band', passed: false });
  });

  it('finds the plan by the level id and runs the checks', () => {
    const def = makeGardenDef([{ ...fixtureA, id: 'g01', maxTurns: 6 }]) as unknown as GameDef<Json, unknown>;
    const result = solveTurn(def, 'g01', 1, turnOptions);
    const checks = levelChecks(def, 'g01', result, tools);
    expect(checks.map((check) => check.name)).toEqual(['size_ok', 'length_in_band', 'turn_limit']);
    expect(checks.filter((check) => !check.passed)).toEqual([]);
  });
});
