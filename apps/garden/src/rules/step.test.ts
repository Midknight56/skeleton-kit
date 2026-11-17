import { hashState } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { fixtureA, fixtureB, fixtureC, fixtureD, tieRight, tieUp } from './fixtures';
import { parseLevel, type RawLevel } from './level';
import type { GardenState } from './state';
import { actions, decodeAction, encodeAction, status, step } from './step';

function start(raw: RawLevel): GardenState {
  const parsed = parseLevel(raw);
  if (!parsed.ok) throw new Error(parsed.problems.join('; '));
  return parsed.state;
}

/** Applies each action text in order and returns the state after every action. */
function play(raw: RawLevel, texts: string[]): GardenState[] {
  const states: GardenState[] = [];
  let state = start(raw);
  for (const text of texts) {
    const action = decodeAction(text);
    if (action === null) throw new Error(`bad action text ${text}`);
    state = step(state, action);
    states.push(state);
  }
  return states;
}

const at = (state: GardenState, id: number): { x: number; y: number; home: boolean; caught: boolean } => {
  const moth = state.moths.find((item) => item.id === id);
  if (moth === undefined) throw new Error(`no moth ${id}`);
  return { x: moth.x, y: moth.y, home: moth.home, caught: moth.caught };
};

describe('fixture A, straight', () => {
  it('walks to the flower in two actions and wins', () => {
    const [first, second] = play(fixtureA, ['light:1', 'wait']) as [GardenState, GardenState];
    expect(at(first, 1)).toEqual({ x: 1, y: 0, home: false, caught: false });
    expect(status(first).phase).toBe('playing');
    expect(at(second, 1)).toEqual({ x: 2, y: 0, home: true, caught: false });
    expect(status(second).phase).toBe('won');
    expect(second.turn).toBe(2);
  });
});

describe('fixture B, web', () => {
  it('catches the moth on the web at x 2 and loses with reason web', () => {
    const [first, second] = play(fixtureB, ['light:1', 'wait']) as [GardenState, GardenState];
    expect(at(first, 1)).toEqual({ x: 1, y: 0, home: false, caught: false });
    expect(at(second, 1)).toEqual({ x: 2, y: 0, home: false, caught: true });
    expect(status(second)).toMatchObject({ phase: 'lost', reason: 'web' });
    expect(second.turn).toBe(2);
  });
});

describe('fixture C, queue', () => {
  const states = play(fixtureC, ['light:1', 'wait', 'wait', 'wait', 'wait', 'wait']);

  it('keeps moth 1 back while moth 2 has not moved yet, and lets moth 2 go first', () => {
    expect(at(states[0]!, 1)).toMatchObject({ x: 0, home: false });
    expect(at(states[0]!, 2)).toMatchObject({ x: 2, home: false });
  });

  it('brings moth 2 home at x 3 and moves moth 1 to x 1 after action 2', () => {
    expect(at(states[1]!, 1)).toMatchObject({ x: 1, home: false });
    expect(at(states[1]!, 2)).toMatchObject({ x: 3, home: true });
  });

  it('lets moth 1 stand on the taken flower at x 3 without becoming home', () => {
    expect(at(states[2]!, 1)).toMatchObject({ x: 2, home: false });
    expect(at(states[3]!, 1)).toMatchObject({ x: 3, home: false });
    expect(at(states[3]!, 2)).toMatchObject({ x: 3, home: true });
  });

  it('brings moth 1 home at x 5 after action 6 and wins at turn 6', () => {
    expect(at(states[4]!, 1)).toMatchObject({ x: 4, home: false });
    expect(at(states[5]!, 1)).toMatchObject({ x: 5, home: true });
    expect(status(states[5]!).phase).toBe('won');
    expect(states[5]!.turn).toBe(6);
  });
});

describe('fixture D, switch', () => {
  const states = play(fixtureD, ['light:1', 'light:2', 'wait', 'wait']);

  it('moves the moth onto lantern 1 after action 1', () => {
    expect(at(states[0]!, 1)).toEqual({ x: 0, y: 0, home: false, caught: false });
  });

  it('takes right before down when lantern 2 is lit', () => {
    expect(at(states[1]!, 1)).toMatchObject({ x: 1, y: 0 });
    expect(at(states[2]!, 1)).toMatchObject({ x: 2, y: 0 });
  });

  it('brings the moth home at x 3, y 0 after action 4 and wins at turn 4', () => {
    expect(at(states[3]!, 1)).toEqual({ x: 3, y: 0, home: true, caught: false });
    expect(status(states[3]!).phase).toBe('won');
    expect(states[3]!.turn).toBe(4);
  });

  it('catches the moth on the web when only lantern 2 is lit', () => {
    const lost = play(fixtureD, ['light:2', 'wait']);
    expect(at(lost[0]!, 1)).toMatchObject({ x: 1, y: 1 });
    expect(at(lost[1]!, 1)).toMatchObject({ x: 2, y: 1, caught: true });
    expect(status(lost[1]!)).toMatchObject({ phase: 'lost', reason: 'web' });
  });
});

const texts = (state: GardenState): string[] => actions(state).map(encodeAction);

describe('actions', () => {
  const three: RawLevel = { id: 't3', title: 'Three', maxTurns: 9, rows: ['m.f3', '.12.'] };

  it('lists light for each lantern in ascending order, and no wait while nothing is lit', () => {
    expect(texts(start(three))).toEqual(['light:1', 'light:2', 'light:3']);
  });

  it('leaves out the lit lantern and adds wait after it', () => {
    const [afterTwo] = play(three, ['light:2']) as [GardenState];
    expect(texts(afterTwo)).toEqual(['light:1', 'light:3', 'wait']);
  });

  it('lists nothing in phase won and in phase lost', () => {
    const won = play(fixtureA, ['light:1', 'wait'])[1]!;
    const lost = play(fixtureB, ['light:1', 'wait'])[1]!;
    expect(status(won).phase).toBe('won');
    expect(actions(won)).toEqual([]);
    expect(status(lost).phase).toBe('lost');
    expect(actions(lost)).toEqual([]);
  });
});

describe('encodeAction and decodeAction', () => {
  it('round trips light:1 to light:5 and wait', () => {
    for (const text of ['light:1', 'light:2', 'light:3', 'light:4', 'light:5', 'wait']) {
      const action = decodeAction(text);
      expect(action, text).not.toBeNull();
      expect(encodeAction(action!)).toBe(text);
    }
  });

  it('decodes anything else to null', () => {
    for (const text of ['light:0', 'light:6', 'light:01', 'Light:1', 'wait ', '', 'light:', 'light:1 ', ' light:1', 'wait*2', 'none']) {
      expect(decodeAction(text), JSON.stringify(text)).toBeNull();
    }
  });
});

describe('unlisted actions', () => {
  const same = (state: GardenState, text: string): void => {
    const action = decodeAction(text);
    expect(action, text).not.toBeNull();
    const before = hashState(state);
    expect(hashState(step(state, action!)), text).toBe(before);
    expect(hashState(state)).toBe(before);
  };

  it('ignores light for the lit lantern', () => {
    same(play(fixtureA, ['light:1'])[0]!, 'light:1');
  });

  it('ignores wait before any lantern is lit', () => {
    same(start(fixtureA), 'wait');
  });

  it('ignores light for a lantern the level does not have', () => {
    same(start(fixtureA), 'light:3');
  });

  it('ignores every action after the end', () => {
    const won = play(fixtureA, ['light:1', 'wait'])[1]!;
    const lost = play(fixtureB, ['light:1', 'wait'])[1]!;
    for (const text of ['light:1', 'light:2', 'wait']) {
      same(won, text);
      same(lost, text);
    }
  });

  it('does not change the turn count for an ignored action', () => {
    const state = start(fixtureA);
    expect(step(state, { kind: 'wait' }).turn).toBe(0);
  });
});

describe('step does not change its input', () => {
  it('gives a new object and leaves the old one as it was', () => {
    const state = start(fixtureC);
    const copy = JSON.parse(JSON.stringify(state)) as GardenState;
    const next = step(state, { kind: 'light', id: 1 });
    expect(next).not.toBe(state);
    expect(state).toEqual(copy);
  });
});

describe('turn limit and score', () => {
  it('loses with reason turns when the limit is reached with a moth still out', () => {
    const [first] = play({ ...fixtureA, maxTurns: 1 }, ['light:1']) as [GardenState];
    expect(status(first)).toMatchObject({ phase: 'lost', reason: 'turns' });
    expect(actions(first)).toEqual([]);
  });

  it('wins, not loses, when the last moth gets home on the last turn', () => {
    const [, second] = play({ ...fixtureA, maxTurns: 2 }, ['light:1', 'wait']) as [GardenState, GardenState];
    expect(status(second).phase).toBe('won');
  });

  it('prefers the web over the turn limit', () => {
    const [, second] = play({ ...fixtureB, maxTurns: 2 }, ['light:1', 'wait']) as [GardenState, GardenState];
    expect(status(second)).toMatchObject({ phase: 'lost', reason: 'web' });
  });

  it('reports the turn count as the score', () => {
    const states = play(fixtureC, ['light:1', 'wait', 'wait']);
    expect(status(start(fixtureC)).score).toBe(0);
    expect(states.map((state) => status(state).score)).toEqual([1, 2, 3]);
  });
});

describe('tie order', () => {
  it('takes right before down', () => {
    const [first] = play(tieRight, ['light:1']) as [GardenState];
    expect(at(first, 1)).toMatchObject({ x: 1, y: 0 });
  });

  it('takes up before the others', () => {
    const [first] = play(tieUp, ['light:1']) as [GardenState];
    expect(at(first, 1)).toMatchObject({ x: 1, y: 1 });
  });
});

describe('movement details', () => {
  it('keeps a moth that stands on the lit lantern where it is', () => {
    const states = play(fixtureD, ['light:1', 'wait', 'wait']);
    expect(at(states[2]!, 1)).toMatchObject({ x: 0, y: 0 });
    expect(states[2]!.turn).toBe(3);
  });

  it('keeps a moth that has no path to the lantern where it is', () => {
    const walled: RawLevel = { id: 'wl', title: 'Walled', maxTurns: 5, rows: ['m#f1'] };
    const [first] = play(walled, ['light:1']) as [GardenState];
    expect(at(first, 1)).toMatchObject({ x: 0, home: false });
    expect(first.turn).toBe(1);
  });

  it('keeps a home moth where it is', () => {
    const twice: RawLevel = { id: 'tw', title: 'Twice', maxTurns: 9, rows: ['m.f.1', '....f'] };
    const states = play(twice, ['light:1', 'wait', 'wait', 'wait']);
    expect(at(states[1]!, 1)).toMatchObject({ x: 2, y: 0, home: true });
    expect(at(states[3]!, 1)).toMatchObject({ x: 2, y: 0, home: true });
  });
});