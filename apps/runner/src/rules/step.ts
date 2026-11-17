import type { Status } from '@kit/core';
import { BOX_H, BOX_W, GRAVITY, JUMP, RUN, TILE } from './constants';
import type { RunnerState } from './state';

export type RunnerAction = 'none' | 'jump';

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// Boxes, with y growing downward and the ground surface at 0.
const playerBox = (state: RunnerState): Box => ({ left: state.x, right: state.x + BOX_W, top: state.feetY - BOX_H, bottom: state.feetY });
const pumpkinBox = (column: number): Box => ({ left: column * TILE, right: column * TILE + TILE, top: -512, bottom: 0 });
const postBox = (column: number): Box => ({ left: column * TILE, right: column * TILE + TILE, top: -640, bottom: 0 });
const candleBox = (column: number, high: boolean): Box => ({
  left: column * TILE + 128,
  right: column * TILE + 384,
  top: high ? -1408 : -896,
  bottom: high ? -1152 : -640,
});

const overlaps = (a: Box, b: Box): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** The ground character of a column. A column past the end of the course gives an empty text. */
const groundAt = (state: RunnerState, column: number): string => state.ground.charAt(column);

/** The column of the gate. It is the last column. */
const gateColumn = (state: RunnerState): number => state.ground.length - 1;

/** The tile under the centre of the player's box. */
export const tileUnderCentre = (x: number): number => Math.floor((x + BOX_W / 2) / TILE);

function hitsObstacle(state: RunnerState): boolean {
  const box = playerBox(state);
  const first = Math.floor(state.x / TILE);
  const last = Math.floor((state.x + BOX_W - 1) / TILE);
  for (let column = first; column <= last; column++) {
    const ground = groundAt(state, column);
    if (ground === 'p' && overlaps(box, pumpkinBox(column))) return true;
    if (ground === 'P' && overlaps(box, postBox(column))) return true;
  }
  return false;
}

/** The candle index is the column for `air1` and the column plus 1000 for `air2`. */
function candleBoxOf(index: number): Box {
  return index >= 1000 ? candleBox(index - 1000, true) : candleBox(index, false);
}

export function actions(state: RunnerState): RunnerAction[] {
  if (state.phase !== 'playing') return [];
  return state.onGround ? ['none', 'jump'] : ['none'];
}

export function step(state: RunnerState, action: RunnerAction): RunnerState {
  // Step 0: nothing runs for a refused action, not even the tick count.
  if (state.phase !== 'playing' || !actions(state).includes(action)) return state;

  const next: RunnerState = { ...state, candles: state.candles.slice() };

  // Step 1: the jump.
  if (action === 'jump') {
    next.vy = -JUMP;
    next.onGround = false;
  }
  // Step 2: run.
  next.x += RUN;
  // Step 3: gravity and landing.
  if (!next.onGround) {
    next.vy += GRAVITY;
    next.feetY += next.vy;
    if (next.feetY >= 0) {
      next.feetY = 0;
      next.vy = 0;
      next.onGround = true;
    }
  }
  // Step 4: a fall into a gap.
  if (next.onGround && groundAt(next, tileUnderCentre(next.x)) === '.') {
    next.phase = 'lost';
    next.reason = 'fell';
  }
  // Step 5: a hit on a pumpkin or a post.
  if (next.phase === 'playing' && hitsObstacle(next)) {
    next.phase = 'lost';
    next.reason = 'hit';
  }
  // Step 6: candles, then the gate.
  if (next.phase === 'playing') {
    const box = playerBox(next);
    const kept: number[] = [];
    for (const index of next.candles) {
      if (overlaps(box, candleBoxOf(index))) next.score += 10;
      else kept.push(index);
    }
    next.candles = kept;
    if (next.x >= gateColumn(next) * TILE) {
      next.phase = 'won';
      next.score += 100;
    }
  }
  // Step 7: the tick.
  next.tick += 1;
  return next;
}

export function status(state: RunnerState): Status {
  if (state.phase === 'lost') return { phase: state.phase, score: state.score, reason: state.reason };
  return { phase: state.phase, score: state.score };
}

export function encodeAction(action: RunnerAction): string {
  return action;
}

export function decodeAction(text: string): RunnerAction | null {
  return text === 'none' || text === 'jump' ? text : null;
}
