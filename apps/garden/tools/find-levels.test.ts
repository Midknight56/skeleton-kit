import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeGardenDef } from '../src/def';
import { levelPlans } from '../src/proof';
import { parseLevel } from '../src/rules/level';
import { findLevels, formatFound, makeBoard, parseArgs } from './find-levels';

describe('makeBoard', () => {
  it('gives the same board for the same level and seed', () => {
    expect(makeBoard('g05', 17)).toEqual(makeBoard('g05', 17));
  });

  it('gives different boards for different seeds', () => {
    const boards = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(makeBoard('g05', i + 1))));
    expect(boards.size).toBeGreaterThan(20);
  });

  it('builds boards of at most 9 by 7 with the moth count of the plan, for every level', () => {
    for (const id of Object.keys(levelPlans)) {
      for (let seed = 1; seed <= 40; seed++) {
        const rows = makeBoard(id, seed);
        expect(rows.length, `${id} ${seed}`).toBeLessThanOrEqual(7);
        expect(rows[0]!.length, `${id} ${seed}`).toBeLessThanOrEqual(9);
        const moths = rows.join('').split('m').length - 1;
        expect(moths, `${id} ${seed}`).toBe(levelPlans[id]!.moths);
      }
    }
  });
});

describe('findLevels', () => {
  it('finds at least one board for g01 in seeds 1 to 2000, and each board passes its checks', () => {
    const found = findLevels('g01', 1, 2000);
    expect(found.length).toBeGreaterThan(0);
    for (const item of found) {
      const level = { id: 'g01', title: 'Found', maxTurns: item.maxTurns, rows: item.rows };
      expect(parseLevel(level).ok).toBe(true);
      expect(item.maxTurns).toBe(item.solution.length + 4);
      expect(item.solution.length).toBeGreaterThanOrEqual(2);
      expect(item.solution.length).toBeLessThanOrEqual(3);
      // Playing the solution on the found board wins.
      const def = makeGardenDef([level]);
      let state = def.init('g01', 1);
      for (const text of item.solution) state = def.step(state, def.decodeAction(text)!);
      expect(def.status(state).phase).toBe('won');
    }
  }, 60000);

  it('gives the same list when it runs twice', () => {
    expect(findLevels('g01', 1, 200)).toEqual(findLevels('g01', 1, 200));
  });

  it('throws for a level without a plan', () => {
    expect(() => findLevels('g99', 1, 10)).toThrow(/g99/);
  });
});

describe('command line', () => {
  it('reads --level and --seeds', () => {
    expect(parseArgs(['--level', 'g03', '--seeds', '5-20'])).toEqual({ level: 'g03', from: 5, to: 20, limit: null });
    expect(parseArgs(['--level', 'g03', '--seeds', '5-20', '--limit', '3'])).toEqual({ level: 'g03', from: 5, to: 20, limit: 3 });
  });

  it('rejects missing or bad arguments', () => {
    expect(() => parseArgs([])).toThrow();
    expect(() => parseArgs(['--level', 'g01', '--seeds', '20-5'])).toThrow();
    expect(() => parseArgs(['--level', 'g01', '--seeds', 'x'])).toThrow();
  });

  it('prints the seed, the rows and the solution of a found board', () => {
    const text = formatFound({ seed: 7, rows: ['m.f.1'], maxTurns: 6, solution: ['light:1', 'wait'] });
    expect(text).toContain('seed 7');
    expect(text).toContain('m.f.1');
    expect(text).toContain('light:1 wait');
    expect(text).toContain('maxTurns 6');
  });
});

describe('source', () => {
  it('uses no Math.random', () => {
    const source = readFileSync(new URL('./find-levels.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/Math\s*\.\s*random/);
  });
});
