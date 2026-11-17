import type { RawCourse } from './state';

// Fixture courses of the tests. The expectations are in the design of the broom-runner spec.
// Every ground row has 40 columns and both air rows are all `.`, except where the fixture says it.

const dots = '.'.repeat(40);
const flat = `${'_'.repeat(39)}G`;

/** Ground with one column replaced, for the obstacle fixtures. */
const withGround = (columns: Record<number, string>): string => {
  const chars = Array.from(flat);
  for (const [column, char] of Object.entries(columns)) chars[Number(column)] = char;
  return chars.join('');
};

/** Air row with a candle in one column. */
const candleAt = (column: number): string => `${dots.slice(0, column)}c${dots.slice(column + 1)}`;

/** A, flat. */
export const fixtureA: RawCourse = { id: 'fa', title: 'Flat', air2: dots, air1: dots, ground: flat };

/** B, pumpkin in column 10. */
export const fixtureB: RawCourse = { id: 'fb', title: 'Pumpkin', air2: dots, air1: dots, ground: withGround({ 10: 'p' }) };

/** C, free jump. The same course as A. */
export const fixtureC: RawCourse = { id: 'fc', title: 'Free jump', air2: dots, air1: dots, ground: flat };

/** D, candle in `air1` column 10. The first of the two runs of fixture D. */
export const fixtureD1: RawCourse = { id: 'fd1', title: 'Candle low', air2: dots, air1: candleAt(10), ground: flat };

/** D, candle in `air2` column 10. The second of the two runs of fixture D. */
export const fixtureD2: RawCourse = { id: 'fd2', title: 'Candle high', air2: candleAt(10), air1: dots, ground: flat };

/** E, gap of 1 column in column 10. */
export const fixtureE: RawCourse = { id: 'fe', title: 'Gap', air2: dots, air1: dots, ground: withGround({ 10: '.' }) };

/** F, gap of 2 columns in columns 10 and 11. */
export const fixtureF: RawCourse = { id: 'ff', title: 'Wide gap', air2: dots, air1: dots, ground: withGround({ 10: '.', 11: '.' }) };

/** G, post in column 10. */
export const fixtureG: RawCourse = { id: 'fg', title: 'Post', air2: dots, air1: dots, ground: withGround({ 10: 'P' }) };

export const fixtures: RawCourse[] = [fixtureA, fixtureB, fixtureC, fixtureD1, fixtureD2, fixtureE, fixtureF, fixtureG];
