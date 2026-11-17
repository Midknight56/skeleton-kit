import { hashState, type Json } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { fixtureA, fixtureB, fixtureC, fixtureD1, fixtureD2, fixtureE, fixtureF, fixtureG } from './fixtures';
import { initState, type RawCourse, type RunnerState } from './state';
import { actions, decodeAction, encodeAction, status, step, type RunnerAction } from './step';

/** Applies each action in order and returns the state after every action. */
function play(course: RawCourse, list: RunnerAction[]): RunnerState[] {
  const states: RunnerState[] = [];
  let state = initState(course);
  for (const action of list) {
    state = step(state, action);
    states.push(state);
  }
  return states;
}

const none = (n: number): RunnerAction[] => Array.from({ length: n }, () => 'none');

/** The state after the given number of ticks, counted from 1. */
const after = (states: RunnerState[], ticks: number): RunnerState => {
  const state = states[ticks - 1];
  if (state === undefined) throw new Error(`no state after ${ticks} ticks`);
  return state;
};

describe('fixture A, flat', () => {
  // The gate column is 39, so the gate edge is at 39 * 512 units. The test computes the winning tick.
  let winTick = 0;
  while (44 * winTick < 39 * 512) winTick++;

  it('computes 454 as the winning tick', () => {
    expect(winTick).toBe(454);
  });

  it('is playing after one tick fewer than the winning tick', () => {
    const state = after(play(fixtureA, none(winTick - 1)), winTick - 1);
    expect(state.phase).toBe('playing');
    expect(state.score).toBe(0);
  });

  it('is won with score 100 at the winning tick', () => {
    const state = after(play(fixtureA, none(winTick)), winTick);
    expect(state.phase).toBe('won');
    expect(state.score).toBe(100);
    expect(state.tick).toBe(winTick);
  });
});

describe('fixture B, pumpkin', () => {
  const states = play(fixtureB, none(110));

  it('is playing after 109 ticks with the right edge at 5116, short of 5120', () => {
    const state = after(states, 109);
    expect(state.phase).toBe('playing');
    expect(state.x + 320).toBe(5116);
  });

  it('is lost with reason hit at tick 110, with the right edge at 5160', () => {
    const state = after(states, 110);
    expect(state.phase).toBe('lost');
    expect(state.reason).toBe('hit');
    expect(state.tick).toBe(110);
    expect(state.x + 320).toBe(5160);
  });
});

describe('fixture C, free jump', () => {
  const states = play(fixtureC, ['jump', ...none(40)]);

  it('has feetY -141 after tick 1, -1176 after tick 16 and -48 after tick 32', () => {
    expect(after(states, 1).feetY).toBe(-141);
    expect(after(states, 16).feetY).toBe(-1176);
    expect(after(states, 32).feetY).toBe(-48);
  });

  it('is in the air for ticks 1 to 32', () => {
    for (let t = 1; t <= 32; t++) expect(after(states, t).onGround, `tick ${t}`).toBe(false);
  });

  it('lands after tick 33 with feetY 0, onGround true and x 1452', () => {
    const state = after(states, 33);
    expect(state.feetY).toBe(0);
    expect(state.vy).toBe(0);
    expect(state.onGround).toBe(true);
    expect(state.x).toBe(1452);
  });

  it('ends at x 1804 with score 0 and phase playing', () => {
    const state = after(states, 41);
    expect(state.x).toBe(1804);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });
});

describe('gap, fixture E', () => {
  const states = play(fixtureE, none(113));

  it('has the tile under the box centre 9 after 112 ticks and 10 after 113 ticks', () => {
    const before = after(states, 112);
    expect(before.x).toBe(4928);
    expect(Math.floor((before.x + 160) / 512)).toBe(9);
    expect(before.phase).toBe('playing');
    const at = after(states, 113);
    expect(at.x).toBe(4972);
    expect(Math.floor((at.x + 160) / 512)).toBe(10);
  });

  it('is lost with reason fell at tick 113', () => {
    const state = after(states, 113);
    expect(state.phase).toBe('lost');
    expect(state.reason).toBe('fell');
    expect(state.tick).toBe(113);
    expect(state.feetY).toBe(0);
    expect(state.onGround).toBe(true);
  });

  it('also loses on a gap of 2 columns (fixture F) at tick 113', () => {
    const state = after(play(fixtureF, none(113)), 113);
    expect(state).toMatchObject({ phase: 'lost', reason: 'fell', tick: 113 });
  });
});

describe('post, fixture G', () => {
  it('is lost with reason hit at tick 110 and playing at tick 109', () => {
    const states = play(fixtureG, none(110));
    expect(after(states, 109).phase).toBe('playing');
    expect(after(states, 110)).toMatchObject({ phase: 'lost', reason: 'hit', tick: 110 });
  });
});

describe('candles, fixture D', () => {
  const lowRun: RunnerAction[] = [...none(110), 'jump', ...none(5)];

  it('takes the air1 candle at tick 113, not at tick 112', () => {
    const states = play(fixtureD1, lowRun);
    expect(after(states, 111).x).toBe(4884);
    expect(after(states, 112).x).toBe(4928);
    expect(after(states, 112).score).toBe(0);
    expect(after(states, 112).candles).toEqual([10]);
    expect(after(states, 113).x).toBe(4972);
    expect(after(states, 113).feetY).toBe(-396);
    expect(after(states, 113).score).toBe(10);
    expect(after(states, 113).candles).toEqual([]);
  });

  it('leaves the air1 candle when the player does not jump', () => {
    const states = play(fixtureD1, none(112));
    expect(after(states, 112).score).toBe(0);
    expect(after(states, 112).candles).toEqual([10]);
  });

  it('takes the air2 candle at tick 116 with feetY -711, not at tick 115', () => {
    const states = play(fixtureD2, lowRun);
    expect(after(states, 115).feetY).toBe(-615);
    expect(after(states, 115).score).toBe(0);
    expect(after(states, 115).candles).toEqual([1010]);
    expect(after(states, 116).feetY).toBe(-711);
    expect(after(states, 116).score).toBe(10);
    expect(after(states, 116).candles).toEqual([]);
  });

  it('does not change the input state or its candle list', () => {
    const state = initState(fixtureD1);
    const copy = JSON.parse(JSON.stringify(state)) as RunnerState;
    let next = state;
    for (let i = 0; i < 113; i++) next = step(next, i === 110 ? 'jump' : 'none');
    expect(next.candles).toEqual([]);
    expect(state).toEqual(copy);
    expect(state.candles).toEqual([10]);
  });
});

describe('refused actions', () => {
  const hash = (state: RunnerState): string => hashState(state as unknown as Json);

  it('refuses jump in the air with the same hash', () => {
    const air = after(play(fixtureC, ['jump', 'none', 'none']), 3);
    expect(air.onGround).toBe(false);
    expect(hash(step(air, 'jump'))).toBe(hash(air));
  });

  it('refuses any action after won, with the same hash', () => {
    const won = after(play(fixtureA, none(454)), 454);
    expect(won.phase).toBe('won');
    expect(hash(step(won, 'none'))).toBe(hash(won));
    expect(hash(step(won, 'jump'))).toBe(hash(won));
  });

  it('refuses any action after lost, with the same hash', () => {
    const lost = after(play(fixtureB, none(110)), 110);
    expect(lost.phase).toBe('lost');
    expect(hash(step(lost, 'none'))).toBe(hash(lost));
    expect(hash(step(lost, 'jump'))).toBe(hash(lost));
  });

  it('refuses an action text that is not an action, with the same hash', () => {
    const state = initState(fixtureA);
    expect(hash(step(state, 'fly' as RunnerAction))).toBe(hash(state));
  });
});

describe('actions', () => {
  it('lists none and jump on the ground, in that order', () => {
    expect(actions(initState(fixtureA))).toEqual(['none', 'jump']);
  });

  it('lists only none in the air', () => {
    expect(actions(after(play(fixtureC, ['jump']), 1))).toEqual(['none']);
  });

  it('lists nothing after won and after lost', () => {
    expect(actions(after(play(fixtureA, none(454)), 454))).toEqual([]);
    expect(actions(after(play(fixtureB, none(110)), 110))).toEqual([]);
  });
});

describe('encodeAction and decodeAction', () => {
  it('round trips none and jump', () => {
    expect(encodeAction('none')).toBe('none');
    expect(encodeAction('jump')).toBe('jump');
    expect(decodeAction('none')).toBe('none');
    expect(decodeAction('jump')).toBe('jump');
  });

  it.each(['', 'Jump', 'jump ', 'hop', 'none*2', 'JUMP'])('returns null for the text "%s"', (text) => {
    expect(decodeAction(text)).toBeNull();
  });
});

describe('status', () => {
  it('has no reason while playing', () => {
    expect(status(initState(fixtureA))).toStrictEqual({ phase: 'playing', score: 0 });
  });

  it('has no reason when won', () => {
    expect(status(after(play(fixtureA, none(454)), 454))).toStrictEqual({ phase: 'won', score: 100 });
  });

  it('has the reason when lost', () => {
    expect(status(after(play(fixtureB, none(110)), 110))).toStrictEqual({ phase: 'lost', score: 0, reason: 'hit' });
    expect(status(after(play(fixtureE, none(113)), 113))).toStrictEqual({ phase: 'lost', score: 0, reason: 'fell' });
  });
});
