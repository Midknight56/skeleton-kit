import { runConformance } from '@kit/conformance';
import { createSession, randomInt, validateDef, type GameDef, type Json } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../game.config';
import gardenDef, { makeGardenDef } from './def';
import { fixtureA, fixtureB, fixtureC, fixtureD } from './rules/fixtures';
import type { RawLevel } from './rules/level';
import type { GardenAction } from './rules/step';
import type { GardenState } from './rules/state';

type Def = GameDef<GardenState, GardenAction>;

const hedges: RawLevel = { id: 'hh', title: 'Hedges', maxTurns: 12, rows: ['m.#f.', '..#..', '.1.#f', 'm..#.'] };

const failing = (def: Def): string[] =>
  runConformance(def)
    .filter((result) => !result.passed)
    .map((result) => `${result.name}: ${result.message ?? ''}`);

describe('garden definition', () => {
  it('has the id, kind, rules version and the title from game.config.ts', () => {
    expect(gardenDef.id).toBe('garden');
    expect(gardenDef.kind).toBe('turn');
    expect(gardenDef.rulesVersion).toBe('1');
    expect(gardenDef.title).toBe(gameConfig.title);
  });

  it('is a valid definition', () => {
    expect(validateDef(gardenDef as unknown as GameDef<Json, unknown>)).toEqual([]);
  });

  it('lists the levels in file order with id and title', () => {
    expect(makeGardenDef([fixtureB, fixtureA]).levels()).toEqual([
      { id: 'fb', title: 'Web' },
      { id: 'fa', title: 'Straight' },
    ]);
  });

  it('ignores the seed in init', () => {
    const def = makeGardenDef([fixtureD]);
    expect(def.init('fd', 1)).toEqual(def.init('fd', 99999));
  });

  it('throws a plain Error that names the level and its problems for a bad level', () => {
    const def = makeGardenDef([{ id: 'bad', title: 'Bad', maxTurns: 0, rows: ['..'] }]);
    expect(() => def.init('bad', 1)).toThrow(/bad.*maxTurns/s);
  });
});

describe('garden conformance', () => {
  it('passes runConformance for the default definition', () => {
    expect(failing(gardenDef)).toEqual([]);
  });

  it.each([
    ['A', fixtureA],
    ['B', fixtureB],
    ['C', fixtureC],
    ['D', fixtureD],
    ['hedges', hedges],
  ])('passes runConformance for fixture %s', (_name, raw) => {
    expect(failing(makeGardenDef([raw]))).toEqual([]);
  });
});

describe('garden extra properties', () => {
  const def = makeGardenDef([fixtureA, fixtureB, fixtureC, fixtureD, hedges]);

  it('keeps the moths, keeps them out of hedges, keeps home moths still and counts turns', () => {
    let rng = 2024;
    const draw = (n: number): number => {
      const out = randomInt(rng, n);
      rng = out.state;
      return out.value;
    };
    for (let run = 0; run < 200; run++) {
      const levels = def.levels();
      const id = levels[run % levels.length]!.id;
      const session = createSession(def, id, 1);
      let before = session.state;
      for (let i = 0; i < 20; i++) {
        const legal = session.legal();
        if (legal.length === 0) break;
        const result = session.apply(legal[draw(legal.length)]!);
        expect(result.ok).toBe(true);
        const after = session.state;
        const where = `${id} run ${run} action ${i}`;
        expect(after.moths.map((moth) => moth.id), where).toEqual(before.moths.map((moth) => moth.id));
        expect(after.turn, where).toBe(before.turn + 1);
        for (const moth of after.moths) {
          expect(after.cells[moth.y]![moth.x], where).not.toBe('#');
          const old = before.moths.find((item) => item.id === moth.id)!;
          if (old.home) expect({ x: moth.x, y: moth.y, home: moth.home }, where).toEqual({ x: old.x, y: old.y, home: true });
        }
        before = after;
      }
    }
  });
});
