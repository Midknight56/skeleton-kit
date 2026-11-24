import { createSession } from '@kit/core';
import { describe, expect, it } from 'vitest';
import def from './def';
import { gardenInput } from './input';

// The words a screen reader hears for the garden puzzle.
const say = (levelId: string, actions: string[]): string => {
  const session = createSession(def, levelId, 1);
  let before = session.state;
  for (const text of actions) {
    before = session.state;
    expect(session.apply(text).ok).toBe(true);
  }
  return gardenInput.narrate!(session.state, before, session.status()) ?? '';
};

describe('garden narration', () => {
  it('names the turn, every lantern by number and every moth at the start of g01', () => {
    const text = say('g01', []);
    expect(text).toContain('Turn 0 of 6.');
    expect(text).toContain('No lantern is lit.');
    expect(text).toContain('Lantern 1 is not lit.');
    expect(text).toContain('Lantern 2 is not lit.');
    expect(text).toMatch(/Moth 1 is at column \d, row \d\./);
  });

  it('says which lantern is lit after a move and which are not', () => {
    const text = say('g01', ['light:1']);
    expect(text).toContain('Turn 1 of 6.');
    expect(text).toContain('Lantern 1 is lit.');
    expect(text).toContain('Lantern 2 is not lit.');
    expect(text).not.toContain('No lantern is lit.');
  });

  it('moves the moth in the words after Wait', () => {
    expect(say('g01', ['light:1'])).not.toBe(say('g01', ['light:1', 'wait']));
  });

  it('says the result when the level is won', () => {
    const text = say('g01', ['light:1', 'wait']);
    expect(text).toContain('You won.');
    expect(text).toMatch(/Moth 1 is home on a flower at column \d, row \d\./);
  });

  it('says why the level was lost', () => {
    const start = def.init('g01', 1);
    const caught = { ...start, moths: start.moths.map((m) => ({ ...m, caught: true })) };
    expect(gardenInput.narrate!(caught, null, def.status(caught))).toContain('You lost. Caught in a web.');
    const late = { ...start, turn: start.maxTurns };
    expect(gardenInput.narrate!(late, null, def.status(late))).toContain('You lost. Out of turns.');
  });
});
