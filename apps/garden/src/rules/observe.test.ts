import { describe, expect, it } from 'vitest';
import { fixtureA, fixtureB, fixtureC, fixtureD } from './fixtures';
import { parseLevel, type RawLevel } from './level';
import { observe } from './observe';
import type { GardenState } from './state';
import { decodeAction, step } from './step';

function play(raw: RawLevel, texts: string[]): GardenState {
  const parsed = parseLevel(raw);
  if (!parsed.ok) throw new Error(parsed.problems.join('; '));
  let state = parsed.state;
  for (const text of texts) state = step(state, decodeAction(text)!);
  return state;
}

describe('observe, summary', () => {
  it('says no lantern is lit at the start', () => {
    expect(observe(play(fixtureC, [])).summary).toBe('Turn 0 of 8. No lantern is lit. 0 of 2 moths home.');
  });

  it('names the lit lantern and counts the moths home', () => {
    expect(observe(play(fixtureC, ['light:1', 'wait'])).summary).toBe('Turn 2 of 8. Lantern 1 is lit. 1 of 2 moths home.');
  });

  it('stays at most 120 characters', () => {
    expect(observe(play(fixtureD, ['light:2'])).summary.length).toBeLessThanOrEqual(120);
  });
});

describe('observe, text map', () => {
  it('shows the start of fixture D with a moth on grass and unlit lanterns', () => {
    expect(observe(play(fixtureD, [])).textMap).toEqual(['1..f.', 'm.w.2', '.....']);
  });

  it('shows the lit lantern as * and a home moth as F (fixture C after action 2)', () => {
    expect(observe(play(fixtureC, ['light:1', 'wait'])).textMap).toEqual(['.m.F.f.*']);
  });

  it('shows a caught moth as m on the web cell', () => {
    expect(observe(play(fixtureB, ['light:1', 'wait'])).textMap).toEqual(['..mf*']);
  });

  it('shows a moth on a lantern post as m, not as the lantern', () => {
    expect(observe(play(fixtureD, ['light:1'])).textMap).toEqual(['m..f.', '..w.2', '.....']);
  });

  it('shows m, not F, when a moth that is not home stands on a flower that holds a home moth', () => {
    // Moth 1 stands on the taken flower at x 3 after action 4 of fixture C.
    expect(observe(play(fixtureC, ['light:1', 'wait', 'wait', 'wait'])).textMap).toEqual(['...m.f.*']);
  });

  it('has rows of equal length and the size of the level', () => {
    const map = observe(play(fixtureD, [])).textMap!;
    expect(map).toHaveLength(3);
    expect(map.every((row) => row.length === 5)).toBe(true);
  });
});

describe('observe, facts', () => {
  it('lists the turn, the limit, the lit lantern, the moths, the lanterns and the free flowers', () => {
    expect(observe(play(fixtureD, [])).facts).toEqual({
      turn: 0,
      maxTurns: 8,
      lit: 0,
      moths: [{ id: 1, x: 0, y: 1, home: false, caught: false }],
      lanterns: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 4, y: 1 },
      ],
      flowersFree: 1,
    });
  });

  it('counts flowers that hold no home moth', () => {
    expect(observe(play(fixtureC, [])).facts.flowersFree).toBe(2);
    expect(observe(play(fixtureC, ['light:1', 'wait'])).facts.flowersFree).toBe(1);
    expect(observe(play(fixtureA, ['light:1', 'wait'])).facts).toMatchObject({ flowersFree: 0, lit: 1, turn: 2 });
  });

  it('reports a caught moth in the moth list', () => {
    const facts = observe(play(fixtureB, ['light:1', 'wait'])).facts;
    expect(facts.moths).toEqual([{ id: 1, x: 2, y: 0, home: false, caught: true }]);
  });
});

describe('observe, legend', () => {
  it('explains every map character, and only the lantern digits the level uses', () => {
    const legend = observe(play(fixtureD, [])).legend!;
    expect(Object.keys(legend).sort()).toEqual(['#', '*', '.', '1', '2', 'F', 'f', 'm', 'w'].sort());
    expect(Object.keys(observe(play(fixtureA, [])).legend!).sort()).toEqual(['#', '*', '.', '1', 'F', 'f', 'm', 'w'].sort());
    for (const text of Object.values(legend)) expect(text.length).toBeGreaterThan(0);
  });

  it('covers every character that appears in the map', () => {
    for (const state of [play(fixtureC, ['light:1', 'wait']), play(fixtureB, ['light:1', 'wait']), play(fixtureD, ['light:1'])]) {
      const view = observe(state);
      for (const ch of view.textMap!.join('')) expect(view.legend, ch).toHaveProperty(ch);
    }
  });
});

describe('observe, purity', () => {
  it('does not change the state', () => {
    const state = play(fixtureC, ['light:1', 'wait']);
    const copy = JSON.parse(JSON.stringify(state)) as GardenState;
    observe(state);
    expect(state).toEqual(copy);
  });
});
