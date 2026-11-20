import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { describeFacts } from './difficulty';

const facts = (actions: number, winning: number, legal: number) => ({ actions, firstMoves: { legal, winning } });

describe('describeFacts with first moves', () => {
  it('gives 2 filled of 5 and the exact text for 2 of 5 with 4 actions', () => {
    expect(describeFacts(facts(4, 2, 5))).toEqual({ filled: 2, total: 5, text: 'wins in 4, 2 of 5 first moves win' });
  });

  it('says first move wins when there is one legal first move', () => {
    const d = describeFacts(facts(3, 1, 1));
    expect(d).toEqual({ filled: 1, total: 1, text: 'wins in 3, 1 of 1 first move wins' });
  });

  it('caps 3 of 12 at 8 pips with filled from 1 to 7', () => {
    const d = describeFacts(facts(6, 3, 12));
    expect(d.total).toBe(8);
    expect(d.filled).toBeGreaterThanOrEqual(1);
    expect(d.filled).toBeLessThanOrEqual(7);
    expect(d.text).toBe('wins in 6, 3 of 12 first moves win');
  });

  it('fills every pip for 12 of 12', () => {
    const d = describeFacts(facts(6, 12, 12));
    expect(d.filled).toBe(8);
    expect(d.total).toBe(8);
  });

  it('fills no pip for 0 of 4 and keeps the total', () => {
    const d = describeFacts(facts(5, 0, 4));
    expect(d.filled).toBe(0);
    expect(d.total).toBe(4);
    expect(d.text).toBe('wins in 5, 0 of 4 first moves win');
  });

  it('rounds above 8 as the design says', () => {
    expect(describeFacts(facts(1, 6, 12)).filled).toBe(4);
    expect(describeFacts(facts(1, 1, 60)).filled).toBe(1);
    expect(describeFacts(facts(1, 59, 60)).filled).toBe(7);
  });

  it('keeps all pips at the limit of 8 legal moves', () => {
    expect(describeFacts(facts(1, 5, 8))).toMatchObject({ filled: 5, total: 8 });
  });
});

describe('describeFacts without first moves', () => {
  it('gives no pips and wins in 687 for a turn level', () => {
    expect(describeFacts({ actions: 687 })).toEqual({ filled: 0, total: 0, text: 'wins in 687' });
  });

  it('adds ticks for a tick level', () => {
    expect(describeFacts({ actions: 687 }, 'tick')).toEqual({ filled: 0, total: 0, text: 'wins in 687 ticks' });
  });
});

describe('describeFacts property', () => {
  it('is bounded and exact for legal 0 to 60', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60 }).chain((legal) => fc.tuple(fc.constant(legal), fc.integer({ min: 0, max: legal }))),
        fc.integer({ min: 0, max: 5000 }),
        ([legal, winning], actions) => {
          const d = describeFacts(facts(actions, winning, legal));
          expect(d.filled).toBeLessThanOrEqual(d.total);
          expect(d.total).toBeLessThanOrEqual(8);
          expect(d.text).toContain(String(actions));
          expect(d.text).toContain(String(winning));
          expect(d.text).toContain(String(legal));
          if (d.filled === d.total && d.total > 0) expect(winning).toBe(legal);
          if (winning === legal && legal > 0) expect(d.filled).toBe(d.total);
          if (d.filled === 0) expect(winning).toBe(0);
          if (winning === 0) expect(d.filled).toBe(0);
        },
      ),
    );
  });

  it('uses no word of opinion', () => {
    const d = describeFacts(facts(4, 2, 5));
    expect(d.text).not.toMatch(/easy|hard|tough|safe/i);
  });
});
