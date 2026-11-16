import type { GameDef, Status } from '@kit/core';
import { plainObserve, plainView } from './base';

export type UnlistedState = { n: number };
export type UnlistedAction = 'inc' | 'dec';

function status(state: UnlistedState): Status {
  return state.n >= 5 ? { phase: 'won', score: state.n } : { phase: 'playing', score: state.n };
}

function actions(state: UnlistedState): UnlistedAction[] {
  if (status(state).phase !== 'playing') return [];
  return state.n > 0 ? ['inc', 'dec'] : ['inc'];
}

export const brokenUnlistedAction: GameDef<UnlistedState, UnlistedAction> = {
  id: 'broken-unlisted-action',
  title: 'Broken: unlisted action',
  rulesVersion: '1',
  kind: 'turn',
  levels: () => [{ id: 'b1', title: 'Only level' }],
  init: () => ({ n: 0 }),
  actions,
  // The fault: `dec` is not listed at n = 0, but `step` still accepts it and goes to -1.
  step: (state, action) => ({ n: action === 'inc' ? state.n + 1 : state.n - 1 }),
  status,
  observe: (state) => plainObserve(state.n),
  view: (_state, viewport) => plainView(viewport),
  encodeAction: (action) => action,
  decodeAction: (text) => (text === 'inc' || text === 'dec' ? text : null),
};
