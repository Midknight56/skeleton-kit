import { describe, expect, it } from 'vitest';
import { fixtureA, fixtureC, fixtureD } from './fixtures';
import { parseLevel, type RawLevel } from './level';

const good: RawLevel = { id: 'x', title: 'X', maxTurns: 5, rows: ['m.f.1'] };

function problemsOf(raw: RawLevel): string[] {
  const result = parseLevel(raw);
  return result.ok ? [] : result.problems;
}

function expectProblem(raw: RawLevel, pattern: RegExp): void {
  const problems = problemsOf(raw);
  expect(problems.some((line) => pattern.test(line)), problems.join(' | ')).toBe(true);
}

describe('parseLevel, good levels', () => {
  it('gives no problem for a good level', () => {
    expect(parseLevel(good).ok).toBe(true);
    for (const raw of [fixtureA, fixtureC, fixtureD]) expect(parseLevel(raw).ok, raw.id).toBe(true);
  });

  it('builds the start state of fixture D', () => {
    const result = parseLevel(fixtureD);
    expect(result).toEqual({
      ok: true,
      state: {
        level: 'fd',
        w: 5,
        h: 3,
        cells: ['1..f.', '..w.2', '.....'],
        moths: [{ id: 1, x: 0, y: 1, home: false, caught: false }],
        lit: 0,
        turn: 0,
        maxTurns: 8,
      },
    });
  });

  it('numbers moths from 1 in reading order, top row first, left to right', () => {
    const result = parseLevel({ id: 'n', title: 'N', maxTurns: 9, rows: ['m.m', '.1f', 'mff'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.moths.map((moth) => [moth.id, moth.x, moth.y])).toEqual([
      [1, 0, 0],
      [2, 2, 0],
      [3, 0, 2],
    ]);
    expect(result.state.cells).toEqual(['...', '.1f', '.ff']);
  });

  it('accepts the largest board: 9 wide, 7 high, 4 moths', () => {
    const rows = ['mmmm.....', '.........', '.........', '.........', '.........', 'ffff.....', '1........'];
    expect(parseLevel({ ...good, rows }).ok).toBe(true);
  });

  it('accepts a maxTurns of 1 and of 99', () => {
    expect(parseLevel({ ...good, maxTurns: 1 }).ok).toBe(true);
    expect(parseLevel({ ...good, maxTurns: 99 }).ok).toBe(true);
  });

  it('does not change the raw level', () => {
    const raw: RawLevel = { id: 'x', title: 'X', maxTurns: 5, rows: ['m.f.1'] };
    parseLevel(raw);
    expect(raw).toEqual({ id: 'x', title: 'X', maxTurns: 5, rows: ['m.f.1'] });
  });
});

describe('parseLevel, problems', () => {
  it('reports no rows', () => {
    expectProblem({ ...good, rows: [] }, /no rows/i);
  });

  it('reports rows of different lengths and names the row', () => {
    expectProblem({ ...good, rows: ['m.f.1', '....'] }, /row 2.*length/i);
  });

  it('reports a character that is not allowed and names the row and column', () => {
    expectProblem({ ...good, rows: ['m.f.1', '..x..'] }, /row 2, column 3.*"x"/i);
    expectProblem({ ...good, rows: ['m.f.1', '..6..'] }, /row 2, column 3/i);
    expectProblem({ ...good, rows: ['m.f.1', '..F..'] }, /row 2, column 3/i);
  });

  it('reports a width over 9', () => {
    expectProblem({ ...good, rows: ['m.f.1.....'] }, /width/i);
  });

  it('reports a height over 7', () => {
    const rows = ['m.f.1', '.....', '.....', '.....', '.....', '.....', '.....', '.....'];
    expectProblem({ ...good, rows }, /height/i);
  });

  it('reports no moth', () => {
    expectProblem({ ...good, rows: ['..f.1'] }, /no moth/i);
  });

  it('reports more than 4 moths', () => {
    expectProblem({ ...good, rows: ['mmmmm', 'fffff', '1....'] }, /more than 4 moths/i);
  });

  it('reports no lantern', () => {
    expectProblem({ ...good, rows: ['m.f..'] }, /no lantern/i);
  });

  it('reports a repeated lantern id and names the second place', () => {
    expectProblem({ ...good, rows: ['m.f.1', '1....'] }, /row 2, column 1.*lantern 1/i);
  });

  it('reports fewer flowers than moths', () => {
    expectProblem({ ...good, rows: ['mm.f1'] }, /fewer flowers/i);
  });

  it('reports a maxTurns of 0, 100, 2.5 and one that is not a number', () => {
    for (const maxTurns of [0, 100, 2.5, Number.NaN, -3]) expectProblem({ ...good, maxTurns }, /maxturns/i);
    expectProblem({ ...good, maxTurns: '5' as unknown as number }, /maxturns/i);
  });

  it('reports every problem of a bad level, not only the first', () => {
    const problems = problemsOf({ id: 'bad', title: 'Bad', maxTurns: 0, rows: ['..x'] });
    expect(problems.length).toBeGreaterThanOrEqual(4);
  });

  it('never throws on rows that are not text or a missing list', () => {
    expect(() => parseLevel({ id: 'a', title: 'A', maxTurns: 3, rows: [1, null] as unknown as string[] })).not.toThrow();
    expect(() => parseLevel({ id: 'a', title: 'A', maxTurns: 3 } as unknown as RawLevel)).not.toThrow();
    expect(problemsOf({ id: 'a', title: 'A', maxTurns: 3 } as unknown as RawLevel).length).toBeGreaterThan(0);
  });
});
