import { describe, expect, it } from 'vitest';
import { KitError } from './errors';
import { hashState } from './hash';
import { createSession } from './session';
import { hop, lights } from './test-fixtures';

describe('createSession', () => {
  it('starts from init with tick 0', () => {
    const s = createSession(lights, 'l1', 7);
    expect(s.state).toEqual(lights.init('l1', 7));
    expect(s.tick).toBe(0);
    expect(s.level).toBe('l1');
    expect(s.seed).toBe(7);
    expect(s.def).toBe(lights);
    expect(s.hash()).toBe(hashState(lights.init('l1', 7)));
    expect(s.status().phase).toBe('playing');
  });

  it('accepts the seed limits 0 and 2147483647', () => {
    expect(createSession(hop, 'h1', 0).seed).toBe(0);
    expect(createSession(hop, 'h1', 2147483647).seed).toBe(2147483647);
  });

  it('throws unknown_level for a level that is not listed', () => {
    expect(() => createSession(lights, 'nope', 0)).toThrowError(KitError);
    try {
      createSession(lights, 'nope', 0);
    } catch (error) {
      expect((error as KitError).code).toBe('unknown_level');
    }
  });

  it.each([-1, 2147483648, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('throws bad_seed for seed %s', (seed) => {
    try {
      createSession(lights, 'l1', seed);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(KitError);
      expect((error as KitError).code).toBe('bad_seed');
    }
  });
});

describe('apply on a turn game', () => {
  it('applies a legal action, adds 1 to the tick and returns hash and status', () => {
    const s = createSession(lights, 'l2', 0);
    const result = s.apply('press:0,0');
    expect(result.ok).toBe(true);
    expect(s.tick).toBe(1);
    expect(s.state).toEqual(lights.step(lights.init('l2', 0), { x: 0, y: 0 }));
    if (result.ok) {
      expect(result.hash).toBe(s.hash());
      expect(result.status).toEqual(s.status());
    }
  });

  it('wins level l1 with one press and then ends', () => {
    const s = createSession(lights, 'l1', 0);
    const result = s.apply('press:1,1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status.phase).toBe('won');
  });

  it('refuses text that does not decode and changes nothing', () => {
    const s = createSession(lights, 'l1', 0);
    const before = s.hash();
    const result = s.apply('jump');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('bad_action_text');
      expect(result.message.length).toBeGreaterThan(0);
    }
    expect(s.hash()).toBe(before);
    expect(s.tick).toBe(0);
  });

  it('refuses an action that decodes but is not listed and changes nothing', () => {
    // A definition whose decoder accepts a cell that actions() never lists.
    const narrow = { ...lights, actions: (state: { lamps: number[]; moves: number }) => lights.actions(state).slice(0, 2) };
    const s = createSession(narrow, 'l2', 0);
    const before = s.hash();
    const result = s.apply('press:2,2');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('illegal_action');
    expect(s.hash()).toBe(before);
    expect(s.tick).toBe(0);
  });
});

describe('game over', () => {
  it('refuses every text with game_over, including undecodable text, and keeps state and tick', () => {
    const s = createSession(lights, 'l1', 0);
    s.apply('press:1,1');
    const before = s.hash();
    const tick = s.tick;
    for (const text of ['press:0,0', 'press:1,1', 'garbage', '']) {
      const result = s.apply(text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('game_over');
    }
    expect(s.hash()).toBe(before);
    expect(s.tick).toBe(tick);
    expect(s.legal()).toEqual([]);
  });

  it('ends a tick game on a loss and refuses more actions', () => {
    const s = createSession(hop, 'h1', 0);
    for (let i = 0; i < 10; i++) expect(s.apply('none').ok).toBe(true);
    expect(s.status().phase).toBe('lost');
    expect(s.tick).toBe(10);
    expect(s.legal()).toEqual([]);
    const result = s.apply('hop');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('game_over');
    expect(s.tick).toBe(10);
  });
});

describe('legal', () => {
  it('lists the encoded actions in the order of actions()', () => {
    const s = createSession(lights, 'l1', 0);
    expect(s.legal()).toEqual(lights.actions(s.state).map((a) => lights.encodeAction(a)));
    expect(s.legal()[0]).toBe('press:0,0');
    expect(s.legal()[8]).toBe('press:2,2');
    expect(createSession(hop, 'h1', 0).legal()).toEqual(['none', 'hop']);
  });
});

describe('undo', () => {
  it('restores the earlier state and lowers the tick on a turn game', () => {
    const s = createSession(lights, 'l2', 0);
    const start = s.hash();
    s.apply('press:0,0');
    s.apply('press:1,0');
    expect(s.undo()).toBe(true);
    expect(s.tick).toBe(1);
    expect(s.undo()).toBe(true);
    expect(s.tick).toBe(0);
    expect(s.hash()).toBe(start);
    expect(s.undo()).toBe(false);
    expect(s.tick).toBe(0);
  });

  it('can undo a winning move', () => {
    const s = createSession(lights, 'l1', 0);
    s.apply('press:1,1');
    expect(s.undo()).toBe(true);
    expect(s.status().phase).toBe('playing');
  });

  it('returns false and changes nothing on a tick game', () => {
    const s = createSession(hop, 'h1', 0);
    s.apply('none');
    const before = s.hash();
    expect(s.undo()).toBe(false);
    expect(s.hash()).toBe(before);
    expect(s.tick).toBe(1);
  });

  it('keeps 500 states: after 501 applies, 500 undos return true and the next returns false', () => {
    const s = createSession(lights, 'l2', 0);
    for (let i = 0; i < 501; i++) expect(s.apply('press:0,0').ok).toBe(true);
    expect(s.tick).toBe(501);
    for (let i = 0; i < 500; i++) expect(s.undo()).toBe(true);
    expect(s.tick).toBe(1);
    expect(s.undo()).toBe(false);
    expect(s.tick).toBe(1);
  });
});
