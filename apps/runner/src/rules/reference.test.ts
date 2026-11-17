import { hashState, randomInt, type Json } from '@kit/core';
import { describe, expect, it } from 'vitest';
import shipped from '../levels/courses.json';
import { fixtureA, fixtureB, fixtureC, fixtureD1, fixtureD2, fixtureE, fixtureF, fixtureG } from './fixtures';
import { initState, type RawCourse, type RunnerState } from './state';
import { actions, step, type RunnerAction } from './step';

// A slow second version of `step`. Each rule has its own code. Speed is the tick count times 44. The jump
// is read from a formula on the number of ticks since the jump. Obstacles are found by looking at every
// column of the course, and boxes are compared by the distance between their edges.

type Rect = { l: number; r: number; t: number; b: number };

/** True when the two boxes are apart on some side. Touching edges are apart. */
function apart(a: Rect, b: Rect): boolean {
  return a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t;
}

function referenceLegal(state: RunnerState): string[] {
  if (state.phase === 'won' || state.phase === 'lost') return [];
  return state.feetY === 0 && state.vy === 0 ? ['none', 'jump'] : ['none'];
}

/** The ticks since the jump, read from the speed. A jump starts with -150 and each tick adds 9. */
function airTicks(vy: number): number {
  return (vy + 150) / 9;
}

function referenceStep(state: RunnerState, action: string): RunnerState {
  if (!referenceLegal(state).includes(action)) return state;

  const tick = state.tick + 1;
  const x = 44 * tick;
  let feetY = 0;
  let vy = 0;
  let onGround = true;
  const jumping = action === 'jump' || state.feetY !== 0 || state.vy !== 0;
  if (jumping) {
    const k = action === 'jump' ? 1 : airTicks(state.vy) + 1;
    const height = -150 * k + (9 * k * (k + 1)) / 2;
    if (height < 0) {
      feetY = height;
      vy = -150 + 9 * k;
      onGround = false;
    }
  }

  const player: Rect = { l: x, r: x + 320, t: feetY - 448, b: feetY };
  let phase: RunnerState['phase'] = 'playing';
  let reason: RunnerState['reason'] = '';

  const centreColumn = (x + 160 - ((x + 160) % 512)) / 512;
  if (onGround && state.ground.charAt(centreColumn) === '.') {
    phase = 'lost';
    reason = 'fell';
  }
  if (phase === 'playing') {
    for (let column = 0; column < state.ground.length; column++) {
      const kind = state.ground.charAt(column);
      if (kind !== 'p' && kind !== 'P') continue;
      const obstacle: Rect = { l: column * 512, r: column * 512 + 512, t: kind === 'p' ? -512 : -640, b: 0 };
      if (!apart(player, obstacle)) {
        phase = 'lost';
        reason = 'hit';
      }
    }
  }

  let score = state.score;
  let candles = state.candles;
  if (phase === 'playing') {
    candles = [];
    for (const index of state.candles) {
      const high = index >= 1000;
      const column = high ? index - 1000 : index;
      const candle: Rect = { l: column * 512 + 128, r: column * 512 + 384, t: high ? -1408 : -896, b: high ? -1152 : -640 };
      if (apart(player, candle)) candles.push(index);
      else score += 10;
    }
    if (x >= (state.ground.length - 1) * 512) {
      phase = 'won';
      score += 100;
    }
  }

  return { ...state, tick, x, feetY, vy, onGround, candles, score, phase, reason };
}

const hash = (state: RunnerState): string => hashState(state as unknown as Json);

const courses: RawCourse[] = [fixtureA, fixtureB, fixtureC, fixtureD1, fixtureD2, fixtureE, fixtureF, fixtureG, ...shipped];

/** One random run. Picks are none, jump, and some illegal jumps in the air, and a few picks after the end. */
function randomRun(course: RawCourse, seed: number): { states: number; end: RunnerState } {
  let rng = seed;
  let fast = initState(course);
  let slow = initState(course);
  let count = 0;
  const jumpOdds = 2 + (seed % 3); // 2, 3 or 4 picks in 16
  for (let i = 0; i < 560; i++) {
    const pick = randomInt(rng, 16);
    rng = pick.state;
    const action: RunnerAction = pick.value < jumpOdds ? 'jump' : 'none';
    expect(actions(fast).map(String), `legal actions at tick ${fast.tick}`).toEqual(referenceLegal(slow));
    fast = step(fast, action);
    slow = referenceStep(slow, action);
    expect(fast, `state after pick ${i}`).toEqual(slow);
    expect(hash(fast)).toBe(hash(slow));
    count++;
    if (fast.phase !== 'playing' && i > 3 && pick.value % 2 === 0) break;
  }
  return { states: count, end: fast };
}

// 200 runs take about 3 s alone, longer while the whole suite runs in parallel.
describe('step against a slow reference', { timeout: 30_000 }, () => {
  it('agrees on 200 random runs over fixtures A to G, with jumps in the air among the picks', () => {
    const ends: RunnerState[] = [];
    for (let run = 0; run < 200; run++) {
      const course = courses[run % courses.length]!;
      ends.push(randomRun(course, 1000 + run).end);
    }
    // The runs must reach every kind of end, or the comparison proves little.
    expect(ends.some((end) => end.phase === 'won')).toBe(true);
    expect(ends.some((end) => end.reason === 'hit')).toBe(true);
    expect(ends.some((end) => end.reason === 'fell')).toBe(true);
    expect(ends.some((end) => end.score >= 10 && end.score % 100 !== 0)).toBe(true);
  });

  it('agrees that a jump in the air and any action after the end change nothing', () => {
    const air = step(initState(fixtureA), 'jump');
    expect(referenceStep(air, 'jump')).toBe(air);
    expect(hash(step(air, 'jump'))).toBe(hash(air));
  });
});
