import { describe, expect, it } from 'vitest';
import levelsJson from '../apps/garden/src/levels/levels.json';
import { deriveShortest, MAX_LIMIT, MIN_LIMIT, SHIPPED_LIMIT, readLimit, tryLimit } from './try-rule';

// Task 1 of .kiro/specs/landing-try-a-rule. The wrapper runs the real turn search of the kit on a copy of g03.

const PROOF_HASH = '9a074fd5e9266b9a';

describe('the search wrapper of the landing page', () => {
  it('limit 8 (the shipped value) gives the four move win and the hash of the proof file', () => {
    expect(SHIPPED_LIMIT).toBe(8);
    const result = tryLimit(8);
    expect(result.kind).toBe('won');
    if (result.kind !== 'won') return;
    expect(result.actions).toEqual(['light:2', 'wait', 'light:1', 'wait']);
    expect(result.count).toBe(4);
    expect(result.hash).toBe(PROOF_HASH);
    expect(result.text).toContain('4 moves');
  });

  it('limit 3 exhausts every route and says so in plain words', () => {
    const result = tryLimit(3);
    expect(result.kind).toBe('lost');
    if (result.kind !== 'lost') return;
    expect(result.reason).toBe('exhausted');
    expect(result.text).toMatch(/no route wins within 3 turns/i);
    expect(result.text).toMatch(/ran out/i);
  });

  it('limit 4 still gives a win in four moves', () => {
    const result = tryLimit(4);
    expect(result.kind).toBe('won');
    if (result.kind !== 'won') return;
    expect(result.count).toBe(4);
    expect(result.actions).toEqual(['light:2', 'wait', 'light:1', 'wait']);
  });

  it('Restore, which is limit 8 again after other limits, gives the hash of the proof file', () => {
    tryLimit(3);
    tryLimit(4);
    const again = tryLimit(SHIPPED_LIMIT);
    expect(again.kind === 'won' && again.hash).toBe(PROOF_HASH);
  });

  it('changes no shipped level', () => {
    const before = JSON.stringify(levelsJson);
    tryLimit(3);
    tryLimit(20);
    expect(JSON.stringify(levelsJson)).toBe(before);
    expect(levelsJson.find((level) => level.id === 'g03')?.maxTurns).toBe(8);
  });

  it('answers the same twice', () => {
    expect(tryLimit(5)).toEqual(tryLimit(5));
  });

  it('reads a limit from text and refuses what is not a whole number from the minimum to the maximum', () => {
    expect(readLimit('8')).toBe(8);
    expect(readLimit(' 3 ')).toBe(3);
    for (const bad of ['', 'x', '2.5', '-1', '0', String(MAX_LIMIT + 1), '1e1']) expect(readLimit(bad), bad).toBeNull();
    expect(readLimit(String(MIN_LIMIT))).toBe(MIN_LIMIT);
    expect(readLimit(String(MAX_LIMIT))).toBe(MAX_LIMIT);
  });

  it('stays quick at the largest limit, so the page stays responsive', () => {
    const start = performance.now();
    for (let limit = MIN_LIMIT; limit <= MAX_LIMIT; limit++) tryLimit(limit);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe('the shortest win claim', () => {
  it('limit 3 says every route was exhausted and the shortest win is derived by the search', () => {
    const result = tryLimit(3);
    expect(result.kind === 'lost' && result.shortest).toBe(deriveShortest());
    expect(deriveShortest()).toBe(4);
    expect(result.text).toMatch(/every possible route was exhausted within 3 turns/i);
    expect(result.text).toMatch(/shortest win needs 4 turns/i);
  });

  it('makes no shortest claim when the search hits its cap', () => {
    const result = tryLimit(3, 2);
    expect(result.kind).toBe('lost');
    if (result.kind !== 'lost') return;
    expect(result.reason).toBe('node_limit');
    expect(result.shortest).toBeNull();
    expect(result.text).toMatch(/inconclusive/i);
    expect(result.text).not.toMatch(/needs \d+ turns/);
    expect(deriveShortest(2)).toBeNull();
  });
});
