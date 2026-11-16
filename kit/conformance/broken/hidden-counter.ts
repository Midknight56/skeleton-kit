import type { GameDef, Status } from '@kit/core';
import { plainObserve, plainView } from './base';

export type HiddenState = { n: number; salt: number };
export type HiddenAction = 'inc';

// The fault: `init` reads a counter that lives outside the state, so two fresh sessions differ.
let created = 0;

function status(state: HiddenState): Status {
  return state.n >= 3 ? { phase: 'won', score: state.n } : { phase: 'playing', score: state.n };
}

export const brokenHiddenCounter: GameDef<HiddenState, HiddenAction> = {
  id: 'broken-hidden-counter',
  title: 'Broken: hidden counter',
  rulesVersion: '1',
  kind: 'turn',
  levels: () => [{ id: 'b1', title: 'Only level' }],
  init: () => ({ n: 0, salt: created++ }),
  actions: (state) => (status(state).phase === 'playing' ? ['inc'] : []),
  step: (state, action) => (action === 'inc' && status(state).phase === 'playing' ? { n: state.n + 1, salt: state.salt } : { n: state.n, salt: state.salt }),
  status,
  observe: (state) => plainObserve(state.n),
  view: (_state, viewport) => plainView(viewport),
  encodeAction: (action) => action,
  decodeAction: (text) => (text === 'inc' ? 'inc' : null),
};
