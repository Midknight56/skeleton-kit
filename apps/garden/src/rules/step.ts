import type { Status } from '@kit/core';
import type { GardenState } from './state';

export type GardenAction = { kind: 'light'; id: number } | { kind: 'wait' };

const LIGHT = /^light:([1-5])$/;

// Up, right, down, left. The order decides ties.
const DIRECTIONS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** The ids of the lanterns on the board, ascending. */
function lanternIds(state: GardenState): number[] {
  const ids: number[] = [];
  for (const row of state.cells) {
    for (const ch of row) if (ch >= '1' && ch <= '5') ids.push(Number(ch));
  }
  return ids.sort((a, b) => a - b);
}

export function status(state: GardenState): Status {
  const score = state.turn;
  if (state.moths.some((moth) => moth.caught)) return { phase: 'lost', score, reason: 'web' };
  if (state.moths.every((moth) => moth.home)) return { phase: 'won', score };
  if (state.turn >= state.maxTurns) return { phase: 'lost', score, reason: 'turns' };
  return { phase: 'playing', score };
}

export function actions(state: GardenState): GardenAction[] {
  if (status(state).phase !== 'playing') return [];
  const list: GardenAction[] = [];
  for (const id of lanternIds(state)) if (id !== state.lit) list.push({ kind: 'light', id });
  if (state.lit !== 0) list.push({ kind: 'wait' });
  return list;
}

export function encodeAction(action: GardenAction): string {
  return action.kind === 'wait' ? 'wait' : `light:${action.id}`;
}

export function decodeAction(text: string): GardenAction | null {
  if (text === 'wait') return { kind: 'wait' };
  const match = LIGHT.exec(text);
  return match === null ? null : { kind: 'light', id: Number(match[1]) };
}

function isListed(state: GardenState, action: GardenAction): boolean {
  const text = encodeAction(action);
  return actions(state).some((item) => encodeAction(item) === text);
}

/** Step distance from the lantern to every cell that is not a hedge. -1 means no path. */
function distances(state: GardenState, lantern: string): number[][] {
  const dist = state.cells.map((row) => Array.from(row, () => -1));
  const queue: [number, number][] = [];
  for (let y = 0; y < state.h; y++) {
    const x = state.cells[y]!.indexOf(lantern);
    if (x >= 0) {
      dist[y]![x] = 0;
      queue.push([x, y]);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head]!;
    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= state.w || ny >= state.h) continue;
      if (state.cells[ny]!.charAt(nx) === '#' || dist[ny]![nx] !== -1) continue;
      dist[ny]![nx] = dist[y]![x]! + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

export function step(state: GardenState, action: GardenAction): GardenState {
  const next: GardenState = JSON.parse(JSON.stringify(state)) as GardenState;
  if (!isListed(state, action)) return next;
  if (action.kind === 'light') next.lit = action.id;

  const dist = distances(next, String(next.lit));
  for (const moth of next.moths) {
    if (moth.home || moth.caught) continue;
    const d = dist[moth.y]![moth.x]!;
    if (d <= 0) continue;
    const dir = DIRECTIONS.find(([dx, dy]) => {
      const nx = moth.x + dx;
      const ny = moth.y + dy;
      return nx >= 0 && ny >= 0 && nx < next.w && ny < next.h && next.cells[ny]!.charAt(nx) !== '#' && dist[ny]![nx] === d - 1;
    });
    if (dir === undefined) continue;
    const nx = moth.x + dir[0];
    const ny = moth.y + dir[1];
    if (next.moths.some((other) => other !== moth && !other.home && !other.caught && other.x === nx && other.y === ny)) continue;
    moth.x = nx;
    moth.y = ny;
    const cell = next.cells[ny]!.charAt(nx);
    if (cell === 'w') moth.caught = true;
    else if (cell === 'f' && !next.moths.some((other) => other.home && other.x === nx && other.y === ny)) moth.home = true;
  }
  next.turn += 1;
  return next;
}
