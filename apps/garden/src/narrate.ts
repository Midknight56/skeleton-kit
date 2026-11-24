import type { Status } from '@kit/core';
import { gardenTexts } from './results';
import type { GardenState } from './rules/state';

// The whole state of the garden puzzle in words, for a screen reader. Lanterns go by the number of the
// key that lights them. A moth goes by its place, counted from 1 in columns and rows.
function lanternIds(state: GardenState): number[] {
  const ids: number[] = [];
  for (const row of state.cells) {
    for (const ch of row) if (ch >= '1' && ch <= '5') ids.push(Number(ch));
  }
  return ids.sort((a, b) => a - b);
}

export function narrateGarden(state: GardenState, _previous: GardenState | null, status: Status): string {
  const parts = [`Turn ${state.turn} of ${state.maxTurns}.`];
  if (state.lit === 0) parts.push('No lantern is lit.');
  for (const id of lanternIds(state)) parts.push(id === state.lit ? `Lantern ${id} is lit.` : `Lantern ${id} is not lit.`);
  for (const moth of state.moths) {
    const place = `at column ${moth.x + 1}, row ${moth.y + 1}`;
    if (moth.caught) parts.push(`Moth ${moth.id} is caught in a web ${place}.`);
    else if (moth.home) parts.push(`Moth ${moth.id} is home on a flower ${place}.`);
    else parts.push(`Moth ${moth.id} is ${place}.`);
  }
  if (status.phase === 'won') parts.push('You won. Every moth is home.');
  else if (status.phase === 'lost') {
    const why = status.reason === undefined ? undefined : gardenTexts.reasons[status.reason];
    parts.push(why ? `You lost. ${why}.` : 'You lost.');
  }
  return parts.join(' ');
}
