import type { GameDef, Status } from '@kit/core';
import { plainObserve, plainView } from './base';

export type ChangedState = { n: number; touched: number };
export type ChangedAction = 'tap';

function status(state: ChangedState): Status {
  return state.n >= 3 ? { phase: 'won', score: state.n } : { phase: 'playing', score: state.n };
}

// A tick game, so the undo property does not apply and only the input check can see the fault.
export const brokenChangedInput: GameDef<ChangedState, ChangedAction> = {
  id: 'broken-changed-input',
  title: 'Broken: changed input',
  rulesVersion: '1',
  kind: 'tick',
  ticksPerSecond: 10,
  levels: () => [{ id: 'b1', title: 'Only level' }],
  init: () => ({ n: 0, touched: 0 }),
  actions: (state) => (status(state).phase === 'playing' ? ['tap'] : []),
  step(state, action) {
    if (action !== 'tap' || status(state).phase !== 'playing') return { n: state.n, touched: state.touched };
    // The fault: this line changes the state that the caller passed in.
    state.touched += 1;
    return { n: state.n + 1, touched: state.touched };
  },
  status,
  observe: (state) => plainObserve(state.n),
  view: (_state, viewport) => plainView(viewport),
  encodeAction: (action) => action,
  decodeAction: (text) => (text === 'tap' ? 'tap' : null),
};
