import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { nextRandom, randomInt } from './random';

// Reference loop written from the published mulberry32 steps. It returns the raw 32 bit value.
function referenceSequence(start: number, count: number): number[] {
  let a = start | 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    out.push((t ^ (t >>> 14)) >>> 0);
  }
  return out;
}

function run(start: number, count: number): number[] {
  const out: number[] = [];
  let state = start;
  for (let i = 0; i < count; i++) {
    const next = nextRandom(state);
    out.push(next.value);
    state = next.state;
  }
  return out;
}

describe('nextRandom', () => {
  it('matches the reference loop for the first 5 outputs from state 1', () => {
    expect(run(1, 5)).toEqual(referenceSequence(1, 5));
  });

  it('matches the reference loop for 1000 outputs from several states', () => {
    for (const start of [0, 1, 2, 12345, 2147483647, 2147483648, 4294967295]) {
      expect(run(start, 1000)).toEqual(referenceSequence(start, 1000));
    }
  });

  it('returns value and state as integers from 0 to 4294967295', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4294967295 }), (start) => {
        const { value, state } = nextRandom(start);
        for (const n of [value, state]) {
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(4294967295);
        }
      }),
    );
  });

  it('gives equal sequences for equal states', () => {
    expect(run(777, 500)).toEqual(run(777, 500));
    expect(run(777, 20)).not.toEqual(run(778, 20));
  });

  it('does not change with a state that went through the output of a call', () => {
    const first = nextRandom(99);
    expect(nextRandom(first.state)).toEqual(nextRandom(first.state));
    expect(first).toEqual(nextRandom(99));
  });
});

describe('randomInt', () => {
  it('is nextRandom value modulo n, with the same next state', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4294967295 }), fc.integer({ min: 1, max: 65536 }), (start, n) => {
        const plain = nextRandom(start);
        expect(randomInt(start, n)).toEqual({ value: plain.value % n, state: plain.state });
      }),
    );
  });

  it('stays in 0 to n minus 1 for n from 1 to 65536', () => {
    for (const n of [1, 2, 3, 6, 100, 65535, 65536]) {
      let state = 5;
      for (let i = 0; i < 300; i++) {
        const next = randomInt(state, n);
        expect(Number.isInteger(next.value)).toBe(true);
        expect(next.value).toBeGreaterThanOrEqual(0);
        expect(next.value).toBeLessThan(n);
        state = next.state;
      }
    }
    expect(randomInt(42, 1).value).toBe(0);
  });

  it('gives equal sequences for equal states', () => {
    const roll = (start: number): number[] => {
      const out: number[] = [];
      let state = start;
      for (let i = 0; i < 100; i++) {
        const next = randomInt(state, 6);
        out.push(next.value);
        state = next.state;
      }
      return out;
    };
    expect(roll(3)).toEqual(roll(3));
  });

  it('throws a RangeError for n outside 1 to 65536 or not an integer', () => {
    for (const n of [0, -1, 65537, 1.5, NaN]) {
      expect(() => randomInt(1, n)).toThrow(RangeError);
    }
  });
});
