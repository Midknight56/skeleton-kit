// Checks that the prover runs on each level of the garden puzzle. The prover loads this file as dist/proof.js.
import type { GameDef, Json } from '@kit/core';
import type { SolveResult, TurnOptions, solveTick, solveTurn } from '@kit/solver';
import type { GardenState } from './rules/state';

// The same shapes as in kit/solver/src/prove.ts. The solver package does not export them.
export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}
export type ProofTools = { solveTurn: typeof solveTurn; solveTick: typeof solveTick };

export interface CheckPlan {
  moths: number;
  band: [number, number] | null;
  needsSwitch: boolean;
  webMatters: boolean;
}

/**
 * The key leaves out the turn. The search visits states in order of depth, so the first visit of a board has
 * the fewest turns, and reaching the same board in more turns is never better.
 */
export const turnOptions: TurnOptions = {
  key: (state: Json): Json => {
    const garden = state as unknown as GardenState;
    return { lit: garden.lit, moths: garden.moths } as unknown as Json;
  },
  maxDepth: 40,
};

function plan(moths: number, band: [number, number], needsSwitch: boolean, webMatters: boolean): CheckPlan {
  return { moths, band, needsSwitch, webMatters };
}

export const levelPlans: Record<string, CheckPlan> = {
  g01: plan(1, [2, 3], false, false),
  g02: plan(1, [3, 4], false, false),
  g03: plan(1, [4, 6], true, false),
  g04: plan(2, [5, 8], true, true),
  g05: plan(2, [5, 8], true, true),
  g06: plan(2, [6, 11], true, true),
  g07: plan(2, [6, 11], true, true),
  g08: plan(2, [6, 11], true, true),
  g09: plan(3, [9, 13], true, true),
  g10: plan(3, [9, 13], true, true),
  g11: plan(3, [11, 16], true, true),
  g12: plan(3, [11, 16], true, true),
};

const result = (name: string, passed: boolean, detail: string): CheckResult => ({ name, passed, detail });

function lanternIds(state: GardenState): number[] {
  const ids: number[] = [];
  for (const row of state.cells) for (const ch of row) if (ch >= '1' && ch <= '5') ids.push(Number(ch));
  return ids.sort((a, b) => a - b);
}

function sizeCheck(state: GardenState | null, problem: string, plan: CheckPlan): CheckResult {
  if (state === null) return result('size_ok', false, problem);
  const lanterns = lanternIds(state).length;
  const flowers = state.cells.join('').split('f').length - 1;
  const problems: string[] = [];
  if (state.w > 9) problems.push(`width ${state.w} is over 9`);
  if (state.h > 7) problems.push(`height ${state.h} is over 7`);
  if (lanterns < 1 || lanterns > 4) problems.push(`${lanterns} lanterns, the plan allows 1 to 4`);
  if (state.moths.length !== plan.moths) problems.push(`${state.moths.length} moths, the plan has ${plan.moths}`);
  if (flowers < state.moths.length) problems.push(`${flowers} flowers for ${state.moths.length} moths`);
  return problems.length === 0
    ? result('size_ok', true, `${state.w} by ${state.h}, ${lanterns} lanterns, ${state.moths.length} moths, ${flowers} flowers`)
    : result('size_ok', false, problems.join('; '));
}

/** Plays `light:k` and then `wait` until the game ends. True when the level is lost with reason web. */
function webRun(def: GameDef<Json, unknown>, levelId: string, k: number): boolean {
  let state = def.init(levelId, 1);
  const light = def.decodeAction(`light:${k}`);
  const wait = def.decodeAction('wait');
  if (light === null || wait === null) return false;
  state = def.step(state, light);
  for (let i = 0; i < 200 && def.status(state).phase === 'playing'; i++) state = def.step(state, wait);
  const end = def.status(state);
  return end.phase === 'lost' && end.reason === 'web';
}

/** Runs the checks that the plan asks for. It does not throw for a level that has problems. */
export function runChecks(def: GameDef<Json, unknown>, levelId: string, solved: SolveResult, tools: ProofTools, plan: CheckPlan): CheckResult[] {
  if (!solved.solved) return [result('length_in_band', false, `the level is not solved (${solved.reason})`)];
  const length = solved.actions.length;
  const checks: CheckResult[] = [];

  let state: GardenState | null = null;
  let problem = '';
  try {
    state = def.init(levelId, 1) as unknown as GardenState;
  } catch (error) {
    problem = error instanceof Error ? error.message : String(error);
  }
  checks.push(sizeCheck(state, problem, plan));

  if (plan.band !== null) {
    const [low, high] = plan.band;
    checks.push(result('length_in_band', length >= low && length <= high, `shortest solution ${length}, band ${low} to ${high}`));
  }
  if (state === null) return checks;

  checks.push(result('turn_limit', state.maxTurns === length + 4, `maxTurns ${state.maxTurns}, shortest solution ${length} plus 4 is ${length + 4}`));

  const lanterns = lanternIds(state);
  if (plan.needsSwitch) {
    const alone: number[] = [];
    for (const k of lanterns) {
      const only = tools.solveTurn(def, levelId, 1, { ...turnOptions, allow: (text: string) => text === `light:${k}` || text === 'wait' });
      if (only.solved) alone.push(k);
    }
    checks.push(
      result('needs_switch', alone.length === 0, alone.length === 0 ? 'no single lantern wins' : `lantern ${alone.join(', ')} wins alone`),
    );
  }
  if (plan.webMatters) {
    const trapped = lanterns.filter((k) => webRun(def, levelId, k));
    checks.push(
      result('web_matters', trapped.length > 0, trapped.length > 0 ? `lantern ${trapped.join(', ')} alone ends in a web` : 'no lantern alone ends in a web'),
    );
  }
  return checks;
}

/** The checks for a shipped level. The plan comes from `levelPlans`. */
export function levelChecks(def: GameDef<Json, unknown>, levelId: string, solved: SolveResult, tools: ProofTools): CheckResult[] {
  const levelPlan = levelPlans[levelId];
  if (levelPlan === undefined) return [result('size_ok', false, `there is no check plan for the level "${levelId}"`)];
  return runChecks(def, levelId, solved, tools, levelPlan);
}
