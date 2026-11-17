import type { Json, Observation } from '@kit/core';
import { BOX_W, RUN, TILE } from './constants';
import type { RunnerState } from './state';
import { tileUnderCentre } from './step';

const MAP_COLUMNS = 24;

type NextKind = 'pumpkin' | 'post' | 'gap' | 'gate';

const LEGEND: Record<string, string> = {
  _: 'ground',
  ':': 'gap, the player falls',
  p: 'pumpkin, jump over it',
  P: 'post, jump over it',
  G: 'gate, the end of the course',
  c: 'candle, 10 points',
  '.': 'empty air',
  ' ': 'past the end of the course',
};

const KIND_OF: Record<string, NextKind> = { '.': 'gap', p: 'pumpkin', P: 'post' };

/**
 * The next run of non-ground columns whose left edge is at or past the right edge of the player's box, and the
 * smallest number of ticks, from 1, for which the right edge would be past its left edge while the player runs.
 * When there is no such run it is the gate, and the number counts from 0.
 */
function nextThing(state: RunnerState): { kind: NextKind; startsInTicks: number } {
  const right = state.x + BOX_W;
  const { ground } = state;
  for (let column = 0; column < ground.length - 1; column++) {
    const kind = KIND_OF[ground.charAt(column)];
    if (kind === undefined) continue;
    const previous = column > 0 ? ground.charAt(column - 1) : '_';
    if (previous in KIND_OF) continue; // inside a run, the run began at an earlier column
    if (column * TILE < right) continue;
    return { kind, startsInTicks: Math.floor((column * TILE - right) / RUN) + 1 };
  }
  const gateEdge = (ground.length - 1) * TILE;
  return { kind: 'gate', startsInTicks: Math.max(0, Math.ceil((gateEdge - state.x) / RUN)) };
}

function mapRow(state: RunnerState, row: string): string {
  const first = tileUnderCentre(state.x);
  let line = '';
  for (let column = first; column < first + MAP_COLUMNS; column++) {
    if (column >= state.ground.length) {
      line += ' ';
      continue;
    }
    const char = row.charAt(column);
    line += row === state.ground && char === '.' ? ':' : char;
  }
  return line;
}

export function observe(state: RunnerState): Observation {
  const tick = `Tick ${state.tick}.`;
  const next = state.phase === 'playing' ? nextThing(state) : null;
  let summary: string;
  if (state.phase === 'won') summary = `${tick} Won with score ${state.score}.`;
  else if (state.phase === 'lost') summary = `${tick} Lost: ${state.reason}.`;
  else summary = `${tick} ${state.onGround ? 'On the ground.' : 'In the air.'} Next: ${next!.kind} in ${next!.startsInTicks} ticks.`;

  // Candles taken are left out of the map. The rows hold all candles, so the map rebuilds them from the list.
  const air = (row: string, offset: number): string =>
    Array.from(row, (char, column) => (char === 'c' && !state.candles.includes(column + offset) ? '.' : char)).join('');

  return {
    summary,
    textMap: [mapRow(state, air(state.air2, 1000)), mapRow(state, air(state.air1, 0)), mapRow(state, state.ground)],
    legend: { ...LEGEND },
    facts: {
      tick: state.tick,
      x: state.x,
      feetY: state.feetY,
      vy: state.vy,
      onGround: state.onGround,
      tile: tileUnderCentre(state.x),
      next: next === null ? null : ({ kind: next.kind, startsInTicks: next.startsInTicks } as Json),
      candlesLeft: state.candles.length,
      score: state.score,
    },
  };
}
