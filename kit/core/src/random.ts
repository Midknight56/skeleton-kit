/** mulberry32. `rngState` is an unsigned 32 bit integer. Returns a value and the next state, both from 0 to 4294967295. */
export function nextRandom(rngState: number): { value: number; state: number } {
  const a = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: (t ^ (t >>> 14)) >>> 0, state: a >>> 0 };
}

/** An integer from 0 to n minus 1, for n from 1 to 65536. The small bias of `%` is accepted. */
export function randomInt(rngState: number, n: number): { value: number; state: number } {
  if (!Number.isInteger(n) || n < 1 || n > 65536) {
    throw new RangeError(`randomInt needs an integer n from 1 to 65536, got ${String(n)}`);
  }
  const next = nextRandom(rngState);
  return { value: next.value % n, state: next.state };
}
