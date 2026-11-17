import { describe, expect, it } from 'vitest';
import { parseCourse } from './course';
import { fixtureA, fixtureD1, fixtureD2 } from './fixtures';
import { initState, type RawCourse } from './state';

/** A course of the given length with a plain ground row that ends in the gate. */
function course(ground: string, air1?: string, air2?: string): RawCourse {
  return { id: 't', title: 'Test', ground, air1: air1 ?? '.'.repeat(ground.length), air2: air2 ?? '.'.repeat(ground.length) };
}

const flat = (length: number): string => `${'_'.repeat(length - 1)}G`;

function problemsOf(raw: RawCourse): string[] {
  const result = parseCourse(raw);
  if (result.ok) throw new Error('the course was accepted');
  return result.problems;
}

describe('parseCourse', () => {
  it('accepts a good course and returns its start state', () => {
    const result = parseCourse(fixtureA);
    expect(result).toEqual({ ok: true, state: initState(fixtureA) });
  });

  it('accepts the shortest and the longest course', () => {
    expect(parseCourse(course(flat(40))).ok).toBe(true);
    expect(parseCourse(course(flat(200))).ok).toBe(true);
  });

  it('reports a course shorter than 40 columns', () => {
    expect(problemsOf(course(flat(39))).join('\n')).toMatch(/39 columns/);
  });

  it('reports a course longer than 200 columns', () => {
    expect(problemsOf(course(flat(201))).join('\n')).toMatch(/201 columns/);
  });

  it('reports rows of different lengths', () => {
    const raw = course(flat(40), '.'.repeat(39));
    expect(problemsOf(raw).join('\n')).toMatch(/different lengths/);
  });

  it('reports a course with no gate', () => {
    expect(problemsOf(course('_'.repeat(40))).join('\n')).toMatch(/no G/);
  });

  it('reports a gate that is not in the last column and names its column', () => {
    const ground = `${'_'.repeat(20)}G${'_'.repeat(18)}G`;
    const problems = problemsOf(course(ground));
    expect(problems).toEqual(['Column 21: the gate G may only be in the last column.']);
  });

  it('reports a last column that is not a gate', () => {
    const ground = `${'_'.repeat(20)}G${'_'.repeat(19)}`;
    expect(problemsOf(course(ground))).toContain('Column 21: the gate G may only be in the last column.');
  });

  it.each([
    ['a pumpkin', 'p', 3],
    ['a post', 'P', 6],
    ['a gap', '.', 1],
  ])('reports %s in the first 6 columns and names its column', (_name, char, column) => {
    const chars = Array.from(flat(40));
    chars[column - 1] = char;
    const problems = problemsOf(course(chars.join('')));
    expect(problems.some((problem) => problem.startsWith(`Column ${column}:`) && /first 6 columns/.test(problem))).toBe(true);
  });

  it('reports a candle in the first 6 columns of an air row', () => {
    const air1 = `..c${'.'.repeat(37)}`;
    const problems = problemsOf(course(flat(40), air1));
    expect(problems.some((problem) => problem.startsWith('Column 3:') && /first 6 columns/.test(problem))).toBe(true);
    const air2 = `......c${'.'.repeat(33)}`;
    expect(parseCourse(course(flat(40), undefined, air2)).ok).toBe(true);
  });

  it('accepts a gap of 2 columns and reports a gap of 3 columns with its first column', () => {
    const two = `${'_'.repeat(10)}..${'_'.repeat(27)}G`;
    expect(parseCourse(course(two)).ok).toBe(true);
    const three = `${'_'.repeat(10)}...${'_'.repeat(26)}G`;
    expect(problemsOf(course(three))).toEqual(['Column 11: a gap of 3 columns is longer than 2.']);
  });

  it('reports a character that is not allowed in each row, with the row and the column', () => {
    const ground = `${'_'.repeat(9)}x${'_'.repeat(29)}G`;
    expect(problemsOf(course(ground))).toContain('Row ground, column 10: "x" is not allowed.');
    const air1 = `${'.'.repeat(11)}p${'.'.repeat(28)}`;
    expect(problemsOf(course(flat(40), air1))).toContain('Row air1, column 12: "p" is not allowed.');
    const air2 = `${'.'.repeat(12)}_${'.'.repeat(27)}`;
    expect(problemsOf(course(flat(40), undefined, air2))).toContain('Row air2, column 13: "_" is not allowed.');
  });

  it('never throws on rows that are empty', () => {
    expect(problemsOf({ id: 'e', title: 'E', air2: '', air1: '', ground: '' }).length).toBeGreaterThan(0);
  });
});

describe('initState', () => {
  it('gives the start state of requirement 1.4', () => {
    expect(initState(fixtureA)).toEqual({
      level: 'fa',
      air2: fixtureA.air2,
      air1: fixtureA.air1,
      ground: fixtureA.ground,
      tick: 0,
      x: 0,
      feetY: 0,
      vy: 0,
      onGround: true,
      candles: [],
      score: 0,
      phase: 'playing',
      reason: '',
    });
  });

  it('lists the candles of the rows, air1 as the column and air2 as the column plus 1000, ascending', () => {
    expect(initState(fixtureD1).candles).toEqual([10]);
    expect(initState(fixtureD2).candles).toEqual([1010]);
    const air1 = `${'.'.repeat(30)}c${'.'.repeat(9)}`.replace(/^(.{12})\./, '$1c');
    const air2 = `${'.'.repeat(11)}c${'.'.repeat(28)}`;
    expect(initState(course(flat(40), air1, air2)).candles).toEqual([12, 30, 1011]);
  });
});
