import { describe, expect, it } from 'vitest';
import { KitError } from './errors';
import type { GameDef, Observation, Scene, Status, Viewport } from './types';

type TinyState = { n: number };
type TinyAction = 'inc';

const tiny: GameDef<TinyState, TinyAction> = {
  id: 'tiny',
  title: 'Tiny',
  rulesVersion: '1',
  kind: 'turn',
  levels: () => [{ id: 't1', title: 'One' }],
  init: () => ({ n: 0 }),
  actions: () => ['inc'],
  step: (state) => ({ n: state.n + 1 }),
  status: (state): Status => ({ phase: state.n >= 2 ? 'won' : 'playing', score: state.n }),
  observe: (state): Observation => ({ summary: `n is ${state.n}`, facts: { n: state.n } }),
  view: (_state, viewport: Viewport): Scene => ({ width: viewport.width, height: viewport.height, items: [] }),
  encodeAction: () => 'inc',
  decodeAction: (text) => (text === 'inc' ? 'inc' : null),
};

// A definition with a missing member must not type check.
// @ts-expect-error decodeAction is missing
const missing: GameDef<TinyState, TinyAction> = {
    id: 'bad',
    title: 'Bad',
    rulesVersion: '1',
    kind: 'turn',
    levels: () => [],
    init: () => ({ n: 0 }),
    actions: () => [],
    step: (state) => state,
    status: (): Status => ({ phase: 'playing', score: 0 }),
    observe: (): Observation => ({ summary: '', facts: {} }),
    view: (): Scene => ({ width: 1, height: 1, items: [] }),
    encodeAction: () => 'inc',
  };

describe('contract types', () => {
  it('lets a tiny game definition be built and called', () => {
    expect(tiny.id).toBe('tiny');
    expect(tiny.step(tiny.init('t1', 0), 'inc')).toEqual({ n: 1 });
    expect(tiny.decodeAction('nope')).toBeNull();
  });

  it('keeps the bad definition out of any run', () => {
    expect(missing.id).toBe('bad');
  });

  it('builds a KitError with a code and a path', () => {
    const error = new KitError('not_plain_data', 'bad value', 'a.b');
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('not_plain_data');
    expect(error.path).toBe('a.b');
  });
});
