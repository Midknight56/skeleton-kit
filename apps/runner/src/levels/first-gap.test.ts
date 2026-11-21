import { describe, expect, it } from 'vitest';
import { obstaclesOf } from '../proof';
import { BOX_W, RUN, TILE, TPS } from '../rules/constants';
import type { RawCourse } from '../rules/state';
import courses from './courses.json';

// Three first time testers lost course r01 at its first gap on every try (blind test of 2026-11-20).
// The first gap of r01 teaches the jump: the player has time to read the chip and to try a jump on
// safe ground, and a candle that only a jump can take rewards that first try.
const r01 = (courses as RawCourse[]).find((course) => course.id === 'r01')!;

describe('the first gap of r01 teaches the jump', () => {
  const first = obstaclesOf(r01.ground)[0]!;
  // The tick at which the centre of the player first reaches the gap.
  const reachTick = Math.ceil((first.first * TILE - BOX_W / 2) / RUN);

  it('is one column wide', () => {
    expect(r01.ground.charAt(first.first)).toBe('.');
    expect(first.last).toBe(first.first);
  });

  it('comes after at least 4 seconds of plain run', () => {
    expect(reachTick / TPS).toBeGreaterThanOrEqual(4);
  });

  it('has two low candles on safe ground before it, which only a jump can take', () => {
    const before = [...r01.air1.slice(0, first.first)].filter((char) => char === 'c').length;
    expect(before).toBeGreaterThanOrEqual(2);
  });
});
