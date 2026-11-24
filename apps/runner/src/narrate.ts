import type { Status } from '@kit/core';
import { obstaclesOf } from './proof';
import { BOX_W, RUN, TILE } from './rules/constants';
import type { RunnerState } from './rules/state';
import { step } from './rules/step';

// The runner in words, for a screen reader. It speaks only when something changes, so a run is a few
// short sentences and not one for each tick.

// An obstacle is called out when it is this many ticks away.
const AHEAD_TICKS = 90;
// An obstacle further away than this cannot be cleared by a jump taken now.
const REACH_TICKS = 150;
// Ticks the player must still be playing after the jump has cleared the obstacle. The same as the window of the prover.
const PLAYING_AFTER = 10;

interface Ahead {
  kind: string;
  right: number;
  ticks: number;
}

const KIND: Record<string, string> = { '.': 'Gap', p: 'Pumpkin', P: 'Post' };

/** The next obstacle that the player has not passed, and the ticks until the player's right edge reaches it. */
function aheadOf(state: RunnerState): Ahead | null {
  for (const obstacle of obstaclesOf(state.ground)) {
    const right = (obstacle.last + 1) * TILE;
    if (right <= state.x) continue;
    const left = obstacle.first * TILE;
    return { kind: KIND[state.ground.charAt(obstacle.first)] ?? 'Obstacle', right, ticks: Math.max(0, Math.floor((left - (state.x + BOX_W)) / RUN)) };
  }
  return null;
}

/** True when a jump taken from this state clears the next obstacle. It steps the rules of the game. */
function jumpClears(state: RunnerState): boolean {
  if (state.phase !== 'playing' || !state.onGround) return false;
  const ahead = aheadOf(state);
  if (ahead === null || ahead.ticks > REACH_TICKS) return false;
  let now = step(state, 'jump');
  for (let guard = 0; now.phase === 'playing' && !(now.onGround && now.x >= ahead.right) && guard < 1000; guard++) now = step(now, 'none');
  for (let i = 0; i < PLAYING_AFTER && now.phase === 'playing'; i++) now = step(now, 'none');
  return now.phase === 'playing' || now.phase === 'won';
}

export function narrateRunner(state: RunnerState, previous: RunnerState | null, status: Status): string | null {
  if (previous === null) return state.tick === 0 ? 'Run started.' : null;
  if (state.tick === previous.tick) return null;
  const said: string[] = [];
  if (state.phase === 'won') return `Reached the gate. Score ${status.score}.`;
  if (state.phase === 'lost') return state.reason === 'fell' ? 'Fell in a gap.' : 'Hit an obstacle.';
  if (!previous.onGround && state.onGround) said.push('Landed.');
  const now = aheadOf(state);
  const before = aheadOf(previous);
  if (now !== null && now.ticks <= AHEAD_TICKS && (before === null || before.right !== now.right || before.ticks > AHEAD_TICKS)) said.push(`${now.kind} ahead.`);
  if (jumpClears(state) && !jumpClears(previous)) said.push('Jump now.');
  return said.length > 0 ? said.join(' ') : null;
}
