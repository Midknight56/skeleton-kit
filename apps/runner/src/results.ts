import type { GameTexts } from '@kit/shell';
import { levelPlans } from './proof';
import type { RunnerState } from './rules/state';

// The proof file of a tick level holds the check `window_ok` as free text and has no number field,
// so N of the watch text comes from `levelPlans`. `proof.ts` pulls in only types of the solver, so the
// page bundle holds no solver code.
export function fairTicks(levelId: string): number | null {
  return Object.prototype.hasOwnProperty.call(levelPlans, levelId) ? (levelPlans[levelId]?.minWindow ?? null) : null;
}

// 3 stars when every candle was taken, 2 when at least half were, 1 otherwise. No candle gives 3.
export function tickStars(start: RunnerState, end: RunnerState): 1 | 2 | 3 {
  const total = start.candles.length;
  if (total === 0) return 3;
  const taken = total - end.candles.length;
  if (taken >= total) return 3;
  return taken * 2 >= total ? 2 : 1;
}

export const runnerTexts: GameTexts<RunnerState> = {
  reasons: {
    hit: 'Hit an obstacle',
    fell: 'Fell in a gap',
  },
  tickStars,
  fairTicks,
};
