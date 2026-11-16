import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonical';
import { KitError } from './errors';
import type { Json } from './types';

function bad(value: unknown): KitError {
  try {
    canonicalJson(value as Json);
  } catch (error) {
    expect(error).toBeInstanceOf(KitError);
    return error as KitError;
  }
  throw new Error('canonicalJson did not throw');
}

describe('canonicalJson', () => {
  it('writes scalars', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(true)).toBe('true');
    expect(canonicalJson(false)).toBe('false');
    expect(canonicalJson(42)).toBe('42');
    expect(canonicalJson(-1.5)).toBe('-1.5');
    expect(canonicalJson(-0)).toBe('0');
    expect(canonicalJson('a"b\n')).toBe('"a\\"b\\n"');
  });

  it('sorts object keys by code unit and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: [3, 2, 1], B: 0 })).toBe('{"B":0,"a":[3,2,1],"b":1}');
    expect(canonicalJson({ z: 1, '\u00e9': 2, a: 3 })).toBe('{"a":3,"z":1,"\u00e9":2}');
  });

  it('gives the same text for any key order, also when nested', () => {
    const one = { a: 1, b: { c: [1, { x: 1, y: 2 }], d: null } };
    const two = { b: { d: null, c: [1, { y: 2, x: 1 }] }, a: 1 };
    expect(canonicalJson(one)).toBe(canonicalJson(two));
  });

  it('writes no spaces', () => {
    expect(canonicalJson({ a: [1, 2], b: {} })).toBe('{"a":[1,2],"b":{}}');
  });

  it('throws not_plain_data with the path for each bad value', () => {
    expect(bad({ a: [1, { b: undefined }] }).path).toBe('$.a[1].b');
    expect(bad(undefined).path).toBe('$');
    expect(bad({ f: () => 1 }).path).toBe('$.f');
    expect(bad([NaN]).path).toBe('$[0]');
    expect(bad({ n: Infinity }).path).toBe('$.n');
    expect(bad({ n: -Infinity }).path).toBe('$.n');
    expect(bad({ m: new Map() }).path).toBe('$.m');
    expect(bad({ s: new Set() }).path).toBe('$.s');
    expect(bad({ d: new Date(0) }).path).toBe('$.d');
    expect(bad({ d: new Date(0) }).code).toBe('not_plain_data');
  });

  it('throws for a class instance, a symbol and a bigint', () => {
    class Thing {
      x = 1;
    }
    expect(bad({ t: new Thing() }).path).toBe('$.t');
    expect(bad({ s: Symbol('x') }).path).toBe('$.s');
    expect(bad({ b: BigInt(1) }).path).toBe('$.b');
  });

  it('throws for a cycle', () => {
    const loop: { self?: unknown } = {};
    loop.self = loop;
    expect(bad(loop).code).toBe('not_plain_data');
  });
});
