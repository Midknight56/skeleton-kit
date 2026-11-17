import type { RawLevel } from './level';

// Fixture levels of the tests. The expectations are in the design of the garden-puzzle spec.

/** A, straight. */
export const fixtureA: RawLevel = { id: 'fa', title: 'Straight', maxTurns: 4, rows: ['m.f.1'] };

/** B, web. */
export const fixtureB: RawLevel = { id: 'fb', title: 'Web', maxTurns: 4, rows: ['m.wf1'] };

/** C, queue. */
export const fixtureC: RawLevel = { id: 'fc', title: 'Queue', maxTurns: 8, rows: ['mm.f.f.1'] };

/** D, switch. */
export const fixtureD: RawLevel = { id: 'fd', title: 'Switch', maxTurns: 8, rows: ['1..f.', 'm.w.2', '.....'] };

/** Tie order, right before down. */
export const tieRight: RawLevel = { id: 'tr', title: 'Tie right', maxTurns: 8, rows: ['m..', '..1', '..f'] };

/** Tie order, up first. */
export const tieUp: RawLevel = { id: 'tu', title: 'Tie up', maxTurns: 8, rows: ['.1.', '...', '.mf'] };

export const fixtures: RawLevel[] = [fixtureA, fixtureB, fixtureC, fixtureD];
