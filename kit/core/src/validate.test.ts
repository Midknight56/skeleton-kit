import { describe, expect, it } from 'vitest';
import type { GameDef, Json } from './types';
import { validateDef } from './validate';

type Def = GameDef<Json, unknown>;

function make(overrides: Record<string, unknown> = {}, remove: string[] = []): Def {
  const base: Record<string, unknown> = {
    id: 'good-1',
    title: 'Good',
    rulesVersion: '1',
    kind: 'turn',
    levels: () => [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
    init: () => ({}),
    actions: () => [],
    step: (state: Json) => state,
    status: () => ({ phase: 'playing', score: 0 }),
    observe: () => ({ summary: '', facts: {} }),
    view: () => ({ width: 1, height: 1, items: [] }),
    encodeAction: () => '',
    decodeAction: () => null,
    ...overrides,
  };
  for (const key of remove) delete base[key];
  return base as unknown as Def;
}

describe('validateDef', () => {
  it('returns no problem for a good turn definition and a good tick definition', () => {
    expect(validateDef(make())).toEqual([]);
    expect(validateDef(make({ kind: 'tick', ticksPerSecond: 60 }))).toEqual([]);
  });

  it('flags an id that is not lower case letters, digits and -', () => {
    for (const id of ['Good', 'a_b', 'a b', '', 'é', 'a.b']) {
      const problems = validateDef(make({ id }));
      expect(problems.length, id).toBe(1);
      expect(problems[0]).toMatch(/^id\b/);
    }
    expect(validateDef(make({ id: '0-a-9' }))).toEqual([]);
  });

  it('flags a levels list that is empty', () => {
    const problems = validateDef(make({ levels: () => [] }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^levels\b/);
  });

  it('flags a repeated level id and names it', () => {
    const problems = validateDef(make({ levels: () => [{ id: 'a', title: 'A' }, { id: 'a', title: 'Again' }] }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^levels\b/);
    expect(problems[0]).toContain('"a"');
  });

  it('flags a level with an empty id', () => {
    const problems = validateDef(make({ levels: () => [{ id: '', title: 'x' }] }));
    expect(problems.some((p) => p.startsWith('levels'))).toBe(true);
  });

  it('flags a levels function that throws, and never throws itself', () => {
    const problems = validateDef(make({ levels: () => { throw new Error('boom'); } }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^levels\b/);
  });

  it('flags a kind that is not turn or tick', () => {
    for (const kind of ['real', '', 'Turn', undefined, 3]) {
      const problems = validateDef(make({ kind }));
      expect(problems.some((p) => p.startsWith('kind')), String(kind)).toBe(true);
    }
  });

  it('requires ticksPerSecond to be an integer from 1 to 120 for a tick game', () => {
    for (const ticksPerSecond of [undefined, 0, 121, 1.5, NaN, Infinity, -5, '60']) {
      const problems = validateDef(make({ kind: 'tick', ticksPerSecond }));
      expect(problems.some((p) => p.startsWith('ticksPerSecond')), String(ticksPerSecond)).toBe(true);
    }
    for (const ticksPerSecond of [1, 10, 60, 120]) {
      expect(validateDef(make({ kind: 'tick', ticksPerSecond })), String(ticksPerSecond)).toEqual([]);
    }
  });

  it('does not ask a turn game for ticksPerSecond', () => {
    expect(validateDef(make({ kind: 'turn' }, ['ticksPerSecond']))).toEqual([]);
  });

  it('names each function member that is missing', () => {
    for (const name of ['levels', 'init', 'actions', 'step', 'status', 'observe', 'view', 'encodeAction', 'decodeAction']) {
      const problems = validateDef(make({}, [name]));
      expect(problems.some((p) => p.startsWith(name)), name).toBe(true);
    }
  });

  it('names a missing or empty title and rulesVersion', () => {
    expect(validateDef(make({ title: '' })).some((p) => p.startsWith('title'))).toBe(true);
    expect(validateDef(make({}, ['rulesVersion'])).some((p) => p.startsWith('rulesVersion'))).toBe(true);
  });

  it('reports one entry for each failing member', () => {
    const problems = validateDef(make({ id: 'Bad', levels: () => [], kind: 'tick' }));
    expect(problems.filter((p) => p.startsWith('id'))).toHaveLength(1);
    expect(problems.filter((p) => p.startsWith('levels'))).toHaveLength(1);
    expect(problems.filter((p) => p.startsWith('ticksPerSecond'))).toHaveLength(1);
    expect(problems).toHaveLength(3);
  });

  it('returns a problem, not a throw, for a value that is not an object', () => {
    expect(validateDef(null as unknown as Def).length).toBeGreaterThan(0);
    expect(validateDef(undefined as unknown as Def).length).toBeGreaterThan(0);
  });
});
