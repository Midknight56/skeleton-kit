import { randomInt } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { fixtureA, fixtureB, fixtureC, fixtureD, tieRight, tieUp } from './fixtures';
import shipped from '../levels/levels.json';
import { parseLevel, type RawLevel } from './level';
import type { GardenState } from './state';
import { actions, decodeAction, encodeAction, step } from './step';

// A slow second version of `step`. It finds distances by repeated relaxation of the whole board
// (not by a queue), it picks the neighbour with the smallest distance by a scan, and it tests
// the legal action list by its own rules.

const ORDER = [
  { dx: 0, dy: -1 }, // up
  { dx: 1, dy: 0 }, // right
  { dx: 0, dy: 1 }, // down
  { dx: -1, dy: 0 }, // left
];

function referenceDistances(state: GardenState, lantern: string): number[][] {
  const big: number = 1000;
  const d: number[][] = state.cells.map((row) => Array.from(row, (ch) => (ch === lantern ? 0 : big)));
  for (let round = 0; round < state.w * state.h + 1; round++) {
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        if (state.cells[y]![x] === '#') continue;
        for (const { dx, dy } of ORDER) {
          const other = d[y + dy]?.[x + dx];
          if (other !== undefined && other + 1 < d[y]![x]!) d[y]![x] = other + 1;
        }
      }
    }
  }
  return d;
}

function referencePhase(state: GardenState): 'playing' | 'won' | 'lost' {
  if (state.moths.some((moth) => moth.caught)) return 'lost';
  if (state.moths.filter((moth) => moth.home).length === state.moths.length) return 'won';
  return state.turn >= state.maxTurns ? 'lost' : 'playing';
}

function referenceListed(state: GardenState, text: string): boolean {
  if (referencePhase(state) !== 'playing') return false;
  if (text === 'wait') return state.lit !== 0;
  const match = /^light:([1-5])$/.exec(text);
  if (match === null) return false;
  return state.cells.join('').includes(match[1]!) && Number(match[1]) !== state.lit;
}

function referenceStep(state: GardenState, text: string): GardenState {
  const next = JSON.parse(JSON.stringify(state)) as GardenState;
  if (!referenceListed(state, text)) return next;
  if (text !== 'wait') next.lit = Number(text.slice(6));
  const d = referenceDistances(next, String(next.lit));
  for (let i = 0; i < next.moths.length; i++) {
    const moth = next.moths[i]!;
    if (moth.home || moth.caught) continue;
    const here = d[moth.y]![moth.x]!;
    if (here === 0 || here >= 1000) continue;
    let target: { x: number; y: number } | null = null;
    for (const { dx, dy } of ORDER) {
      const value = d[moth.y + dy]?.[moth.x + dx];
      if (target === null && value === here - 1) target = { x: moth.x + dx, y: moth.y + dy };
    }
    if (target === null) continue;
    const blocked = next.moths.some((m, j) => j !== i && !m.home && !m.caught && m.x === target!.x && m.y === target!.y);
    if (blocked) continue;
    moth.x = target.x;
    moth.y = target.y;
    const ch = next.cells[target.y]![target.x];
    if (ch === 'w') moth.caught = true;
    if (ch === 'f' && !next.moths.some((m) => m.home && m.x === target!.x && m.y === target!.y)) moth.home = true;
  }
  next.turn += 1;
  return next;
}

function load(raw: RawLevel): GardenState {
  const parsed = parseLevel(raw);
  if (!parsed.ok) throw new Error(`${raw.id}: ${parsed.problems.join('; ')}`);
  return parsed.state;
}

const levelsUnderTest: RawLevel[] = [fixtureA, fixtureB, fixtureC, fixtureD, tieRight, tieUp, ...(shipped as RawLevel[])];

const ALL_TEXTS = ['light:1', 'light:2', 'light:3', 'light:4', 'wait'];

describe('step against the slow reference', () => {
  it('agrees on 300 runs of random picks, listed or not', () => {
    let rng = 12345;
    const draw = (n: number): number => {
      const out = randomInt(rng, n);
      rng = out.state;
      return out.value;
    };
    for (let run = 0; run < 300; run++) {
      const raw = levelsUnderTest[run % levelsUnderTest.length]!;
      let state = load(raw);
      for (let i = 0; i < 14; i++) {
        const listed = actions(state).map(encodeAction);
        // Mostly legal picks, sometimes any text, so that unlisted actions are compared too.
        const text = listed.length > 0 && draw(5) > 0 ? listed[draw(listed.length)]! : ALL_TEXTS[draw(ALL_TEXTS.length)]!;
        const action = decodeAction(text)!;
        const expected = referenceStep(state, text);
        const actual = step(state, action);
        expect(actual, `${raw.id} run ${run} action ${i} "${text}"`).toEqual(expected);
        state = actual;
      }
    }
  });

  it('agrees on the legal action list', () => {
    let rng = 99;
    for (let run = 0; run < 100; run++) {
      const raw = levelsUnderTest[run % levelsUnderTest.length]!;
      let state = load(raw);
      for (let i = 0; i < 10; i++) {
        const listed = actions(state).map(encodeAction);
        const expected = ['light:1', 'light:2', 'light:3', 'light:4', 'light:5', 'wait'].filter((text) => referenceListed(state, text));
        expect(listed, `${raw.id} run ${run} action ${i}`).toEqual(expected);
        if (listed.length === 0) break;
        const pick = randomInt(rng, listed.length);
        rng = pick.state;
        state = step(state, decodeAction(listed[pick.value]!)!);
      }
    }
  });
});
