import type { Observation } from '@kit/core';
import { SIZE, type LampState } from './state';
import { lampsOn } from './step';

// What a program sees: a short summary, a text map and a few facts.
export function observe(state: LampState): Observation {
  const on = lampsOn(state);
  const textMap: string[] = [];
  for (let y = 0; y < SIZE; y++) {
    textMap.push(state.lamps.slice(y * SIZE, y * SIZE + SIZE).map((lamp) => (lamp === 1 ? '#' : '.')).join(''));
  }
  return {
    summary: on === 0 ? 'Every lamp is off.' : `${on} lamp${on === 1 ? ' is' : 's are'} on. A press flips a lamp and its neighbours.`,
    textMap,
    legend: { '#': 'lamp on', '.': 'lamp off' },
    facts: { lampsOn: on, moves: state.moves },
  };
}
