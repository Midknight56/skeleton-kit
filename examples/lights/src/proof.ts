// Options of the prover for this game. The prover loads this file as dist/proof.js.
import type { TurnOptions } from '@kit/solver';
import type { LampState } from './rules/state';

// Two states with the same lamps are the same position, whatever the number of moves, so the search
// keeps only the lamps. Without this key the 4 by 4 board is too wide for the default node limit.
export const turnOptions: TurnOptions = {
  key: (state) => (state as LampState).lamps,
  maxNodes: 200000,
  maxDepth: 12,
};
