import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { GameDef, Status, Viewport } from '@kit/core';
import { createPlay } from './play';
import type { InputEvent, InputMap } from './types';

// A tick game with neutral names. State: a counter and a count of boosts. It is won at 1000 ticks.
type TickState = { n: number; boosts: number };
const tickGame: GameDef<TickState, string> = {
  id: 'fake-tick',
  title: 'Fake tick',
  rulesVersion: '1',
  kind: 'tick',
  ticksPerSecond: 60,
  levels: () => [{ id: 'lv-1', title: 'One' }],
  init: () => ({ n: 0, boosts: 0 }),
  actions: (s) => (s.n >= 1000 ? [] : ['none', 'boost']),
  step: (s, a) => ({ n: s.n + 1, boosts: s.boosts + (a === 'boost' ? 1 : 0) }),
  status: (s) => (s.n >= 1000 ? { phase: 'won', score: s.boosts } : { phase: 'playing', score: s.boosts }),
  observe: (s) => ({ summary: `n ${s.n}`, facts: { n: s.n } }),
  view: (s, v) => ({
    width: v.width,
    height: v.height,
    items: [{ kind: 'rect', id: 'item-1', layer: 'world', x: 10, y: 10, w: 20, h: 20, fill: '#336699' }],
  }),
  encodeAction: (a) => a,
  decodeAction: (t) => (t === 'none' || t === 'boost' ? t : null),
};

const tickInput: InputMap<TickState> = {
  idle: 'none',
  toAction(event: InputEvent) {
    if (event.type === 'pointer') return event.itemIds.includes('item-1') ? 'boost' : event.itemIds.includes('item-9') ? 'bogus' : null;
    return event.key === ' ' ? 'boost' : event.key === 'x' ? 'bogus' : null;
  },
  buttons: [],
  anchorFor: () => null,
  lessons: [],
};

// A turn game: add 1 or add 2 to a total, won at 3, lost at 4 or more.
type TurnState = { total: number };
const turnGame: GameDef<TurnState, string> = {
  id: 'fake-turn',
  title: 'Fake turn',
  rulesVersion: '1',
  kind: 'turn',
  levels: () => [{ id: 'lv-1', title: 'One' }],
  init: () => ({ total: 0 }),
  actions: (s) => (s.total >= 3 ? [] : ['add1', 'add2']),
  step: (s, a) => ({ total: s.total + (a === 'add1' ? 1 : 2) }),
  status: (s): Status => (s.total >= 4 ? { phase: 'lost', score: s.total, reason: 'over' } : s.total >= 3 ? { phase: 'won', score: s.total } : { phase: 'playing', score: s.total }),
  observe: (s) => ({ summary: `total ${s.total}`, facts: { total: s.total } }),
  view: (s, v) => ({ width: v.width, height: v.height, items: [{ kind: 'rect', id: 'item-1', layer: 'world', x: 0, y: 0, w: 50, h: 50, fill: '#336699' }] }),
  encodeAction: (a) => a,
  decodeAction: (t) => (t === 'add1' || t === 'add2' ? t : null),
};

const turnInput: InputMap<TurnState> = {
  idle: null,
  toAction(event: InputEvent) {
    if (event.type === 'pointer') return event.itemIds.includes('item-1') ? 'add1' : null;
    return event.key === '2' ? 'add2' : null;
  },
  buttons: [],
  anchorFor: () => null,
  lessons: [],
};

const viewport: Viewport = { width: 200, height: 100, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
const tickPlay = (extra: { onPhase?: (s: Status) => void; onApplied?: (t: string) => void } = {}) =>
  createPlay({ def: tickGame, input: tickInput, levelId: 'lv-1', viewport, ...extra });
const turnPlay = (extra: { onPhase?: (s: Status) => void; onApplied?: (t: string) => void } = {}) =>
  createPlay({ def: turnGame, input: turnInput, levelId: 'lv-1', viewport, ...extra });

describe('tick clock at 60 ticks a second', () => {
  it('applies exactly 60 actions in 50 frames of 20 ms', () => {
    const play = tickPlay();
    let total = 0;
    for (let i = 0; i < 50; i++) total += play.frame(20);
    expect(total).toBe(60);
    expect(play.session.tick).toBe(60);
  });

  it('applies 5 of 30 owed in one frame of 500 ms and sets the rest to 0', () => {
    const play = tickPlay();
    expect(play.frame(500)).toBe(5);
    expect(play.accumulator()).toBe(0);
  });

  it('applies 5 of 5.04 owed in a frame of 84 ms and keeps 40', () => {
    const play = tickPlay();
    expect(play.frame(84)).toBe(5);
    expect(play.accumulator()).toBe(40);
  });

  it('applies 5 of 6 owed in a frame of 100 ms and sets the rest to 0', () => {
    const play = tickPlay();
    expect(play.frame(100)).toBe(5);
    expect(play.accumulator()).toBe(0);
  });

  it('adds 3840 in a frame of 16 ms at 4 times speed and applies 3', () => {
    const play = tickPlay();
    expect(play.frame(16, 4)).toBe(3);
    expect(play.accumulator()).toBe(840);
  });

  it('allows 20 ticks in one frame at 4 times speed', () => {
    const play = tickPlay();
    expect(play.frame(500, 4)).toBe(20);
    expect(play.accumulator()).toBe(0);
  });

  it('applies floor(T * 60 / 1000) actions for any frames of at most 80 ms (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 80 }), { minLength: 1, maxLength: 60 }), (frames) => {
        const play = tickPlay();
        let applied = 0;
        for (const dt of frames) applied += play.frame(dt);
        const total = frames.reduce((a, b) => a + b, 0);
        expect(applied).toBe(Math.floor((total * 60) / 1000));
      }),
    );
  });

  it('applies no tick after the level has ended', () => {
    const play = tickPlay();
    for (let i = 0; i < 400; i++) play.frame(80);
    expect(play.session.status().phase).toBe('won');
    const tick = play.session.tick;
    expect(play.frame(80)).toBe(0);
    expect(play.session.tick).toBe(tick);
  });
});

describe('tick input', () => {
  it('uses idle when there is no input', () => {
    const play = tickPlay();
    play.frame(100);
    expect(play.session.state.boosts).toBe(0);
  });

  it('counts an input for one tick only', () => {
    const play = tickPlay();
    expect(play.pointer(15, 15)).toBe(true);
    expect(play.pending()).toBe('boost');
    play.frame(50); // 3 ticks owed
    expect(play.session.state.boosts).toBe(1);
    expect(play.pending()).toBe(null);
  });

  it('uses the last input since the previous tick', () => {
    const play = tickPlay();
    play.key(' ', false);
    expect(play.pending()).toBe('boost');
    play.pointer(150, 90);
    expect(play.pending()).toBe('boost');
  });

  it('ignores a null result and keeps the pending action', () => {
    const play = tickPlay();
    play.key(' ', false);
    expect(play.key('q', false)).toBe(false);
    expect(play.pending()).toBe('boost');
  });

  it('ignores an action text that is not legal and changes nothing', () => {
    const play = tickPlay();
    const before = play.session.hash();
    expect(play.key('x', false)).toBe(false);
    expect(play.pending()).toBe(null);
    expect(play.pointer(15, 15) && play.session.hash() === before).toBe(true);
    expect(play.session.hash()).toBe(before);
  });

  it('ignores a key while a button has focus', () => {
    const play = tickPlay();
    expect(play.key(' ', true)).toBe(false);
    expect(play.pending()).toBe(null);
  });

  it('ignores a pointer outside the play area', () => {
    const play = tickPlay();
    expect(play.pointer(-1, 15)).toBe(false);
    expect(play.pointer(15, 100)).toBe(false);
    expect(play.pointer(200, 15)).toBe(false);
    expect(play.pending()).toBe(null);
    expect(play.pointer(15, 15)).toBe(true);
  });

  it('gives no action when no item is under the pointer', () => {
    const play = tickPlay();
    expect(play.pointer(5, 5)).toBe(false);
  });
});

describe('hud scale', () => {
  const hudGame: GameDef<TurnState, string> = {
    ...turnGame,
    view: (s, v) => ({
      width: v.width,
      height: v.height,
      items: [{ kind: 'text', id: 'hud-turn', layer: 'hud', x: 100, y: v.safe.top + 36, text: `Total ${s.total}`, size: 24, fill: '#ffffff', align: 'center' }],
    }),
  };
  const text = (scale?: number) => {
    const play = createPlay({ def: hudGame, input: turnInput, levelId: 'lv-1', viewport, ...(scale === undefined ? {} : { hudScale: scale }) });
    return play.scene().items[0] as { size: number; y: number };
  };
  it('leaves the scene as the game made it with no scale', () => {
    expect(text()).toMatchObject({ size: 24, y: 36 });
  });
  it('gives hud text of 48 px at scale 2', () => {
    expect(text(2)).toMatchObject({ size: 48, y: 72 });
  });
});

describe('turn game', () => {
  it('applies a legal action at once and counts the tick', () => {
    const applied: string[] = [];
    const play = turnPlay({ onApplied: (t) => applied.push(t) });
    expect(play.pointer(10, 10)).toBe(true);
    expect(play.session.tick).toBe(1);
    expect(play.session.state.total).toBe(1);
    expect(applied).toEqual(['add1']);
  });

  it('changes nothing for a null result', () => {
    const play = turnPlay();
    const before = play.session.hash();
    expect(play.key('9', false)).toBe(false);
    expect(play.pointer(150, 90)).toBe(false);
    expect(play.session.hash()).toBe(before);
  });

  it('changes nothing for an action that is not legal', () => {
    const play = turnPlay();
    const before = play.session.hash();
    expect(play.press('add9')).toBe(false);
    expect(play.session.hash()).toBe(before);
  });

  it('applies the action of a button', () => {
    const play = turnPlay();
    expect(play.press('add2')).toBe(true);
    expect(play.session.state.total).toBe(2);
  });

  it('undoes the last action', () => {
    const play = turnPlay();
    play.press('add1');
    play.press('add1');
    expect(play.undo()).toBe(true);
    expect(play.session.state.total).toBe(1);
    expect(play.undo()).toBe(true);
    expect(play.undo()).toBe(false);
  });

  it('does not undo on a tick game', () => {
    const play = tickPlay();
    play.frame(50);
    expect(play.undo()).toBe(false);
  });

  it('starts with seed 1', () => {
    expect(turnPlay().session.seed).toBe(1);
    expect(tickPlay().session.seed).toBe(1);
  });

  it('sends the results event once, when the phase changes to won', () => {
    const seen: Status[] = [];
    const play = turnPlay({ onPhase: (s) => seen.push(s) });
    play.press('add1');
    expect(seen).toEqual([]);
    play.press('add2');
    expect(seen).toEqual([{ phase: 'won', score: 3 }]);
    play.press('add1');
    expect(seen.length).toBe(1);
  });

  it('sends the results event with the reason for a lost level', () => {
    const seen: Status[] = [];
    const play = turnPlay({ onPhase: (s) => seen.push(s) });
    play.press('add2');
    expect(seen.length).toBe(0);
    play.press('add2');
    expect(seen).toEqual([{ phase: 'lost', score: 4, reason: 'over' }]);
  });

  it('sends the results event of a tick game at the tick that ends it', () => {
    const seen: Status[] = [];
    const play = tickPlay({ onPhase: (s) => seen.push(s) });
    for (let i = 0; i < 400; i++) play.frame(80);
    expect(seen.map((s) => s.phase)).toEqual(['won']);
  });
});

describe('property: illegal input changes nothing', () => {
  it('keeps the hash for any key that gives null or an illegal text', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 3 }), fc.boolean(), (key, focused) => {
        const play = turnPlay();
        const before = play.session.hash();
        const changed = play.key(key, focused);
        if (!changed) expect(play.session.hash()).toBe(before);
      }),
    );
  });
});
