import type { Status } from '@kit/core';
import { SIZE, type LampAction, type LampState } from './state';

// A press flips the lamp and its four neighbours that are on the board.
export function flip(lamps: number[], action: LampAction): number[] {
  const next = lamps.slice();
  const cells: [number, number][] = [
    [action.x, action.y],
    [action.x, action.y - 1],
    [action.x, action.y + 1],
    [action.x - 1, action.y],
    [action.x + 1, action.y],
  ];
  for (const [x, y] of cells) {
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) next[y * SIZE + x] = 1 - (next[y * SIZE + x] as number);
  }
  return next;
}

export function lampsOn(state: LampState): number {
  return state.lamps.filter((lamp) => lamp === 1).length;
}

export function status(state: LampState): Status {
  if (lampsOn(state) === 0) return { phase: 'won', score: state.moves };
  return { phase: 'playing', score: state.moves };
}

export function actions(state: LampState): LampAction[] {
  if (status(state).phase !== 'playing') return [];
  const list: LampAction[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) list.push({ x, y });
  return list;
}

// An action that is not listed changes nothing.
export function step(state: LampState, action: LampAction): LampState {
  const listed = actions(state).some((a) => a.x === action.x && a.y === action.y);
  if (!listed) return { lamps: state.lamps.slice(), moves: state.moves };
  return { lamps: flip(state.lamps, action), moves: state.moves + 1 };
}

export function encodeAction(action: LampAction): string {
  return `press:${action.x},${action.y}`;
}

export function decodeAction(text: string): LampAction | null {
  const match = /^press:([0-3]),([0-3])$/.exec(text);
  if (match === null) return null;
  return { x: Number(match[1]), y: Number(match[2]) };
}
