import { describe, expect, it } from 'vitest';
import { fixtureA, fixtureB, fixtureC, fixtureD1, fixtureE, fixtureG } from './fixtures';
import { observe } from './observe';
import { initState, type RawCourse, type RunnerState } from './state';
import { step, type RunnerAction } from './step';

/** The state after the given actions, from the start of the course. */
function after(course: RawCourse, list: RunnerAction[]): RunnerState {
  let state = initState(course);
  for (const action of list) state = step(state, action);
  return state;
}

const none = (n: number): RunnerAction[] => Array.from({ length: n }, () => 'none');

describe('summary', () => {
  it('names a pumpkin on the ground, at tick 0 and after 20 ticks', () => {
    expect(observe(initState(fixtureB)).summary).toBe('Tick 0. On the ground. Next: pumpkin in 110 ticks.');
    expect(observe(after(fixtureB, none(20))).summary).toBe('Tick 20. On the ground. Next: pumpkin in 90 ticks.');
  });

  it('names the gate on a flat course', () => {
    expect(observe(initState(fixtureA)).summary).toBe('Tick 0. On the ground. Next: gate in 454 ticks.');
  });

  it('says in the air after a jump, and names the gate', () => {
    expect(observe(after(fixtureC, ['jump', ...none(4)])).summary).toBe('Tick 5. In the air. Next: gate in 449 ticks.');
  });

  it('names a post and a gap', () => {
    expect(observe(initState(fixtureG)).summary).toBe('Tick 0. On the ground. Next: post in 110 ticks.');
    expect(observe(initState(fixtureE)).summary).toBe('Tick 0. On the ground. Next: gap in 110 ticks.');
  });

  it('skips a run that the player box has already reached', () => {
    // Jump at tick 102 clears the pumpkin. At tick 110 the right edge of the box is past the pumpkin's left edge.
    const state = after(fixtureB, [...none(102), 'jump', ...none(7)]);
    expect(state.phase).toBe('playing');
    expect(state.tick).toBe(110);
    expect(observe(state).summary).toBe('Tick 110. In the air. Next: gate in 344 ticks.');
  });

  it('gives the won summary with the score', () => {
    const state = after(fixtureA, none(454));
    expect(observe(state).summary).toBe('Tick 454. Won with score 100.');
  });

  it('gives the lost summary with the reason', () => {
    expect(observe(after(fixtureB, none(110))).summary).toBe('Tick 110. Lost: hit.');
    expect(observe(after(fixtureE, none(113))).summary).toBe('Tick 113. Lost: fell.');
  });
});

describe('facts', () => {
  it('gives every fact of requirement 5.2 at tick 0 of fixture B', () => {
    expect(observe(initState(fixtureB)).facts).toEqual({
      tick: 0,
      x: 0,
      feetY: 0,
      vy: 0,
      onGround: true,
      tile: 0,
      next: { kind: 'pumpkin', startsInTicks: 110 },
      candlesLeft: 0,
      score: 0,
    });
  });

  it('gives the state of a jump in the air, with the tile under the centre of the box', () => {
    const facts = observe(after(fixtureC, ['jump', ...none(4)])).facts;
    expect(facts).toEqual({
      tick: 5,
      x: 220,
      feetY: -750 + 135,
      vy: -150 + 45,
      onGround: false,
      tile: 0,
      next: { kind: 'gate', startsInTicks: 449 },
      candlesLeft: 0,
      score: 0,
    });
    expect(observe(after(fixtureA, none(100))).facts.tile).toBe(Math.floor((4400 + 160) / 512));
  });

  it('counts the candles left and the score', () => {
    expect(observe(initState(fixtureD1)).facts.candlesLeft).toBe(1);
    const taken = after(fixtureD1, [...none(110), 'jump', ...none(2)]);
    expect(observe(taken).facts).toMatchObject({ candlesLeft: 0, score: 10 });
  });

  it('has next null when the phase is not playing', () => {
    expect(observe(after(fixtureB, none(110))).facts.next).toBeNull();
    expect(observe(after(fixtureA, none(454))).facts).toMatchObject({ next: null, score: 100 });
  });

  it('counts startsInTicks for the gate from 0', () => {
    // At x 19968 the player is at the gate and the phase is won, so the smallest start is a state one tick before.
    const state = after(fixtureA, none(453));
    expect(state.phase).toBe('playing');
    expect(observe(state).facts.next).toEqual({ kind: 'gate', startsInTicks: 1 });
  });

  it('counts startsInTicks for a run with the right edge strictly past its left edge', () => {
    // After 109 ticks the right edge is 5116. One tick later it is 5160, past 5120.
    expect(observe(after(fixtureB, none(109))).facts.next).toEqual({ kind: 'pumpkin', startsInTicks: 1 });
  });
});

describe('text map', () => {
  it('shows fixture B at tick 0 as three rows of 24 characters', () => {
    const map = observe(initState(fixtureB)).textMap;
    expect(map).toEqual(['.'.repeat(24), '.'.repeat(24), `${'_'.repeat(10)}p${'_'.repeat(13)}`]);
  });

  it('marks a gap with a colon', () => {
    const map = observe(initState(fixtureE)).textMap;
    expect(map?.[2]).toBe(`${'_'.repeat(10)}:${'_'.repeat(13)}`);
  });

  it('starts at the tile under the player and pads past the end with spaces', () => {
    const state = after(fixtureA, none(346));
    expect(Math.floor((state.x + 160) / 512)).toBe(30);
    const map = observe(state).textMap;
    expect(map).toEqual([`${'.'.repeat(10)}${' '.repeat(14)}`, `${'.'.repeat(10)}${' '.repeat(14)}`, `${'_'.repeat(9)}G${' '.repeat(14)}`]);
  });

  it('shows a candle until it is taken and then leaves it out', () => {
    expect(observe(initState(fixtureD1)).textMap?.[1]).toBe(`${'.'.repeat(10)}c${'.'.repeat(13)}`);
    const taken = after(fixtureD1, [...none(110), 'jump', ...none(2)]);
    expect(taken.candles).toEqual([]);
    expect(observe(taken).textMap?.[1]).toBe('.'.repeat(24));
  });

  it('has a legend that gives each character of the map one meaning', () => {
    const result = observe(initState(fixtureB));
    const legend = result.legend ?? {};
    for (const char of ['_', ':', 'p', 'P', 'G', 'c', '.', ' ']) {
      expect(typeof legend[char], `legend for "${char}"`).toBe('string');
    }
    expect(Object.keys(legend).sort()).toEqual(['', ' ', '.', ':', 'G', 'P', '_', 'c', 'p'].filter((key) => key !== ''));
    expect(new Set(Object.values(legend)).size).toBe(Object.keys(legend).length);
  });
});
