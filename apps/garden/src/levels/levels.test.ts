import { solveTick, solveTurn } from '@kit/solver';
import type { GameDef, Json } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { makeGardenDef } from '../def';
import { levelChecks, turnOptions } from '../proof';
import { parseLevel, type RawLevel } from '../rules/level';
import levelsJson from './levels.json';

const levels: RawLevel[] = levelsJson;
const def = makeGardenDef(levels) as unknown as GameDef<Json, unknown>;
const ids = Array.from({ length: 12 }, (_, i) => `g${String(i + 1).padStart(2, '0')}`);

describe('shipped levels', () => {
  it('has the ids g01 to g12 in order', () => {
    expect(levels.map((level) => level.id)).toEqual(ids);
  });

  it('gives each level a short title', () => {
    for (const level of levels) {
      expect(level.title.length, level.id).toBeGreaterThan(0);
      expect(level.title.length, level.id).toBeLessThanOrEqual(24);
    }
    expect(new Set(levels.map((level) => level.title)).size).toBe(levels.length);
  });

  it('parses every level with no problem', () => {
    for (const level of levels) {
      const parsed = parseLevel(level);
      expect(parsed.ok ? [] : parsed.problems, level.id).toEqual([]);
    }
  });

  it('has twelve different boards', () => {
    expect(new Set(levels.map((level) => level.rows.join('/'))).size).toBe(12);
  });

  it('is solved by solveTurn and passes every check that applies, with maxTurns of the length plus 4', () => {
    for (const id of ids) {
      const result = solveTurn(def, id, 1, turnOptions);
      expect(result.solved, id).toBe(true);
      const checks = levelChecks(def, id, result, { solveTurn, solveTick });
      expect(checks.filter((check) => !check.passed), id).toEqual([]);
      expect(checks.map((check) => check.name), id).toContain('turn_limit');
    }
  }, 120000);
});
