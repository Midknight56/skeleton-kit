// Checks that the prover runs on each course of the runner. The prover loads this file as dist/proof.js.
import type { GameDef, Json } from '@kit/core';
import type { SolveResult, solveTick, solveTurn } from '@kit/solver';
import { TILE } from './rules/constants';
import type { RunnerState } from './rules/state';

// The same shapes as in kit/solver/src/prove.ts. The solver package does not export them.
export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}
export type ProofTools = { solveTurn: typeof solveTurn; solveTick: typeof solveTick };

export interface CheckPlan {
  length: number;
  obstacles: number;
  minWindow: number;
}

const plan = (length: number, obstacles: number, minWindow: number): CheckPlan => ({ length, obstacles, minWindow });

export const levelPlans: Record<string, CheckPlan> = {
  r01: plan(60, 3, 9),
  r02: plan(80, 5, 9),
  r03: plan(100, 7, 6),
  r04: plan(120, 9, 6),
  r05: plan(140, 11, 4),
  r06: plan(160, 13, 4),
};

const result = (name: string, passed: boolean, detail: string): CheckResult => ({ name, passed, detail });

/** An obstacle is a longest run of neighbouring ground columns that are not `_` and not `G`. Columns count from 0. */
export interface Obstacle {
  first: number;
  last: number;
}

export function obstaclesOf(ground: string): Obstacle[] {
  const found: Obstacle[] = [];
  for (let column = 0; column < ground.length; column++) {
    const char = ground.charAt(column);
    if (char === '_' || char === 'G') continue;
    const previous = found[found.length - 1];
    if (previous !== undefined && previous.last === column - 1) previous.last = column;
    else found.push({ first: column, last: column });
  }
  return found;
}

export interface WindowResult {
  obstacle: Obstacle;
  /** The number of good jump ticks. */
  window: number;
  /** The tick of the state each good jump is taken from. */
  goodTicks: number[];
  /** True when the good jump ticks are not consecutive. */
  split: boolean;
}

const PLAYING_AFTER = 10;

/**
 * The jump window of each obstacle, as the design defines it. It replays `solvedActions`, takes the first grounded
 * state at or past the right edge of the obstacle before, and tries a jump from that state and from each state that
 * follows it by `none` while the player is playing on the ground.
 */
export function obstacleWindows(def: GameDef<Json, unknown>, levelId: string, solvedActions: string[]): WindowResult[] {
  const none = def.decodeAction('none');
  const jump = def.decodeAction('jump');
  if (none === null || jump === null) throw new Error('The definition has no none and jump actions.');

  const start = def.init(levelId, 1);
  const states: Json[] = [start];
  for (const text of solvedActions) {
    const action = def.decodeAction(text);
    if (action === null) throw new Error(`The solution holds the action "${text}", which the definition does not know.`);
    states.push(def.step(states[states.length - 1]!, action));
  }
  const view = (state: Json): RunnerState => state as unknown as RunnerState;
  const obstacles = obstaclesOf(view(start).ground);

  return obstacles.map((obstacle, index) => {
    const previousRight = index === 0 ? 0 : (obstacles[index - 1]!.last + 1) * TILE;
    const right = (obstacle.last + 1) * TILE;
    const s0 = states.find((state) => {
      const s = view(state);
      return s.onGround && s.phase === 'playing' && s.x >= previousRight;
    });

    const goodTicks: number[] = [];
    const goodIndexes: number[] = [];
    let candidate: Json | undefined = s0;
    for (let n = 0; candidate !== undefined; n++) {
      const from = view(candidate);
      // Jump, then none until the player is on the ground at or past the obstacle or the run ends, then 10 more.
      let state = def.step(candidate, jump);
      while (view(state).phase === 'playing' && !(view(state).onGround && view(state).x >= right)) state = def.step(state, none);
      for (let i = 0; i < PLAYING_AFTER && view(state).phase === 'playing'; i++) state = def.step(state, none);
      const end = view(state).phase;
      if (end === 'playing' || end === 'won') {
        goodTicks.push(from.tick);
        goodIndexes.push(n);
      }
      const walked = def.step(candidate, none);
      candidate = view(walked).phase === 'playing' && view(walked).onGround ? walked : undefined;
    }
    const split = goodIndexes.some((value, i) => i > 0 && value !== goodIndexes[i - 1]! + 1);
    return { obstacle, window: goodTicks.length, goodTicks, split };
  });
}

function lengthCheck(state: RunnerState, plan: CheckPlan): CheckResult {
  const length = state.ground.length;
  const count = obstaclesOf(state.ground).length;
  const problems: string[] = [];
  if (length !== plan.length) problems.push(`${length} columns, the plan has ${plan.length}`);
  if (count !== plan.obstacles) problems.push(`${count} obstacles, the plan has ${plan.obstacles}`);
  return problems.length === 0 ? result('length_ok', true, `${length} columns, ${count} obstacles`) : result('length_ok', false, problems.join('; '));
}

function spacingCheck(state: RunnerState): CheckResult {
  const obstacles = obstaclesOf(state.ground);
  const gate = state.ground.length - 1;
  const problems: string[] = [];
  obstacles.forEach((obstacle, index) => {
    const next = obstacles[index + 1];
    const plain = (next === undefined ? gate : next.first) - obstacle.last - 1;
    if (plain < 4) {
      const to = next === undefined ? 'the gate' : `the obstacle at column ${next.first + 1}`;
      problems.push(`${plain} plain columns between the obstacle at column ${obstacle.first + 1} and ${to}`);
    }
  });
  return problems.length === 0 ? result('spacing_ok', true, 'at least 4 plain columns between obstacles and before the gate') : result('spacing_ok', false, problems.join('; '));
}

function windowCheck(def: GameDef<Json, unknown>, levelId: string, solvedActions: string[], plan: CheckPlan): CheckResult {
  const windows = obstacleWindows(def, levelId, solvedActions);
  const problems: string[] = [];
  for (const item of windows) {
    const where = `the obstacle at column ${item.obstacle.first + 1}`;
    if (item.split) problems.push(`${where}: window is split`);
    else if (item.window < plan.minWindow) problems.push(`${where}: window ${item.window}, the plan needs ${plan.minWindow}`);
  }
  const least = windows.length === 0 ? 0 : Math.min(...windows.map((item) => item.window));
  return problems.length === 0
    ? result('window_ok', true, `smallest window ${least} ticks, the plan needs ${plan.minWindow}`)
    : result('window_ok', false, problems.join('; '));
}

/** Runs the checks of a plan. It does not throw for a course that has problems. */
export function runChecks(def: GameDef<Json, unknown>, levelId: string, solved: SolveResult, tools: ProofTools, plan: CheckPlan): CheckResult[] {
  void tools;
  let state: RunnerState;
  try {
    state = def.init(levelId, 1) as unknown as RunnerState;
  } catch (error) {
    return [result('length_ok', false, error instanceof Error ? error.message : String(error))];
  }
  const checks = [
    lengthCheck(state, plan),
    solved.solved ? result('finishable', true, `solved in ${solved.actions.length} ticks`) : result('finishable', false, `the course is not solved (${solved.reason})`),
    spacingCheck(state),
  ];
  if (solved.solved) checks.push(windowCheck(def, levelId, solved.actions, plan));
  return checks;
}

/** The checks for a shipped course. The plan comes from `levelPlans`. */
export function levelChecks(def: GameDef<Json, unknown>, levelId: string, solved: SolveResult, tools: ProofTools): CheckResult[] {
  const levelPlan = levelPlans[levelId];
  if (levelPlan === undefined) return [result('length_ok', false, `there is no check plan for the course "${levelId}"`)];
  return runChecks(def, levelId, solved, tools, levelPlan);
}
