import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { KitError } from './errors';
import { fnv1a64, hashState } from './hash';
import type { Json } from './types';

// Slow reference, written on purpose with plain number arrays of four 16 bit limbs.
function referenceCanonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(referenceCanonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${referenceCanonical(value[k] as Json)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function referenceHash(text: string): string {
  const bytes = Array.from(Buffer.from(text, 'utf8'));
  let h = [0x2325, 0x8422, 0x9ce4, 0xcbf2]; // low limb first, 0xcbf29ce484222325
  const prime = [0x01b3, 0x0000, 0x0100, 0x0000]; // 0x100000001b3
  for (const byte of bytes) {
    h[0] = (h[0] as number) ^ byte;
    const out = [0, 0, 0, 0];
    let carry = 0;
    for (let k = 0; k < 4; k++) {
      let sum = carry;
      for (let i = 0; i <= k; i++) sum += (h[i] as number) * (prime[k - i] as number);
      out[k] = sum % 65536;
      carry = Math.floor(sum / 65536);
    }
    h = out;
  }
  return [3, 2, 1, 0].map((i) => (h[i] as number).toString(16).padStart(4, '0')).join('');
}

function bad(value: unknown): KitError {
  try {
    hashState(value as Json);
  } catch (error) {
    expect(error).toBeInstanceOf(KitError);
    return error as KitError;
  }
  throw new Error('hashState did not throw');
}

describe('fnv1a64', () => {
  it('matches the published vectors', () => {
    expect(fnv1a64('')).toBe('cbf29ce484222325');
    expect(fnv1a64('a')).toBe('af63dc4c8601ec8c');
    expect(fnv1a64('foobar')).toBe('85944171f73967e8');
  });

  it('agrees with the reference on text with multi byte characters', () => {
    for (const text of ['\u00e9', '\u20ac', '\u{1F383}', 'a\u{1F47B}b', '\ud800', 'x\udc00y']) {
      expect(fnv1a64(text)).toBe(referenceHash(text));
    }
  });
});

describe('hashState', () => {
  it('gives 16 lower case hex characters', () => {
    const values: Json[] = [{}, [], null, 0, 'x', { a: 1 }];
    for (const value of values) {
      expect(hashState(value)).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it('gives the same hash for any key order', () => {
    expect(hashState({ a: 1, b: 2 })).toBe(hashState({ b: 2, a: 1 }));
    expect(hashState({ x: { a: 1, b: [1, 2] }, y: 0 })).toBe(hashState({ y: 0, x: { b: [1, 2], a: 1 } }));
    expect(hashState({})).toBe(hashState(Object.create(null) as Json));
  });

  it('gives different hashes for different states', () => {
    expect(hashState({ a: 1 })).not.toBe(hashState({ a: 2 }));
    expect(hashState([1, 2])).not.toBe(hashState([2, 1]));
    expect(hashState('1')).not.toBe(hashState(1));
  });

  it('agrees with the slow reference on 200 random values', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const json = value as Json;
        expect(hashState(json)).toBe(referenceHash(referenceCanonical(json)));
      }),
      { numRuns: 200 },
    );
  });

  it('agrees with the slow reference on random strings with any character', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        expect(hashState({ text })).toBe(referenceHash(referenceCanonical({ text })));
      }),
      { numRuns: 200 },
    );
  });

  it('throws not_plain_data and names the path for each bad value', () => {
    const cases: [unknown, string][] = [
      [{ a: undefined }, '$.a'],
      [{ a: [() => 1] }, '$.a[0]'],
      [{ a: NaN }, '$.a'],
      [[Infinity], '$[0]'],
      [{ a: { b: -Infinity } }, '$.a.b'],
      [{ m: new Map() }, '$.m'],
      [{ s: new Set([1]) }, '$.s'],
      [{ d: new Date(0) }, '$.d'],
    ];
    for (const [value, path] of cases) {
      const error = bad(value);
      expect(error.code).toBe('not_plain_data');
      expect(error.path).toBe(path);
      expect(error.message).toContain(path);
    }
  });
});
