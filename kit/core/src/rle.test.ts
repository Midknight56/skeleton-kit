import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { KitError } from './errors';
import { compressActions, expandActions } from './rle';

function expandOk(items: string[]): string[] {
  const result = expandActions(items);
  if (!result.ok) throw new Error(result.message);
  return result.actions;
}

describe('compressActions', () => {
  it('joins equal neighbours as text*n', () => {
    expect(compressActions(['a', 'a', 'a', 'b'])).toEqual(['a*3', 'b']);
    expect(compressActions(['a', 'b', 'a'])).toEqual(['a', 'b', 'a']);
    expect(compressActions(['a', 'a'])).toEqual(['a*2']);
    expect(compressActions([])).toEqual([]);
  });

  it('splits a run longer than 3600', () => {
    const run = (n: number): string[] => new Array<string>(n).fill('a');
    expect(compressActions(run(3600))).toEqual(['a*3600']);
    expect(compressActions(run(3601))).toEqual(['a*3600', 'a']);
    expect(compressActions(run(3602))).toEqual(['a*3600', 'a*2']);
    expect(compressActions(run(7201))).toEqual(['a*3600', 'a*3600', 'a']);
  });

  it('throws not_plain_data for a text that holds *', () => {
    for (const list of [['a*'], ['x', 'a*2'], ['*']]) {
      try {
        compressActions(list);
        throw new Error('did not throw');
      } catch (error) {
        expect(error).toBeInstanceOf(KitError);
        expect((error as KitError).code).toBe('not_plain_data');
      }
    }
  });
});

describe('expandActions', () => {
  it('expands text*n and keeps plain items', () => {
    expect(expandOk(['a*3', 'b', 'c*2'])).toEqual(['a', 'a', 'a', 'b', 'c', 'c']);
    expect(expandOk([])).toEqual([]);
    expect(expandOk(['press:1,1'])).toEqual(['press:1,1']);
  });

  it('accepts the limits 2 and 3600', () => {
    expect(expandOk(['a*2'])).toHaveLength(2);
    expect(expandOk(['a*3600'])).toHaveLength(3600);
  });

  it('refuses a count below 2, above 3600 or missing', () => {
    for (const item of ['a*1', 'a*0', 'a*3601', 'a*99999', 'a*', 'a*-2']) {
      const result = expandActions([item]);
      expect(result.ok, item).toBe(false);
      if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('refuses more than one *, a missing text and a count that is not plain digits', () => {
    for (const item of ['a*2*3', '*3', '*', 'a**2', 'a*x', 'a*2.5', 'a*02', 'a*1e2', 'a* 2', 'a*+2', 'a*0x10']) {
      expect(expandActions([item]).ok, item).toBe(false);
    }
  });

  it('refuses the whole list when one item is bad', () => {
    expect(expandActions(['a*2', 'b*1', 'c']).ok).toBe(false);
  });
});

describe('round trip', () => {
  it('expand(compress(list)) equals list on 100 random lists', () => {
    const word = fc.constantFrom('a', 'b', 'hop', 'press:1,1');
    const runs = fc
      .array(fc.tuple(word, fc.integer({ min: 1, max: 8 })), { maxLength: 20 })
      .map((pairs) => pairs.flatMap(([text, n]) => new Array<string>(n).fill(text)));
    fc.assert(
      fc.property(runs, (list) => {
        const packed = compressActions(list);
        expect(expandOk(packed)).toEqual(list);
        for (const item of packed) expect(item.includes('*') ? /^[^*]+\*(\d+)$/.test(item) : true).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('round trips a run of 3601 and a mixed long list', () => {
    const list = [...new Array<string>(3601).fill('a'), 'b', ...new Array<string>(5000).fill('c')];
    expect(expandOk(compressActions(list))).toEqual(list);
  });
});
