import { hashState, type GameDef, type Json } from '@kit/core';
import { solveTick, solveTurn } from '@kit/solver';
import { describe, expect, it } from 'vitest';
import runnerDef, { makeRunnerDef } from '../def';
import { levelPlans, obstaclesOf, runChecks } from '../proof';
import { parseCourse } from '../rules/course';
import type { RawCourse, RunnerState } from '../rules/state';
import { step } from '../rules/step';
import courses from './courses.json';

const tools = { solveTurn, solveTick };
const list: RawCourse[] = courses;
const ids = ['r01', 'r02', 'r03', 'r04', 'r05', 'r06'];

describe('shipped courses', () => {
  it('has the ids r01 to r06 in order', () => {
    expect(list.map((course) => course.id)).toEqual(ids);
  });

  it.each(ids)('parses %s with no problem', (id) => {
    const course = list.find((item) => item.id === id)!;
    expect(parseCourse(course)).toMatchObject({ ok: true });
  });

  it('has the lengths 60, 80, 100, 120, 140 and 160 columns', () => {
    expect(list.map((course) => course.ground.length)).toEqual([60, 80, 100, 120, 140, 160]);
  });

  it('has 3, 5, 7, 9, 11 and 13 obstacles', () => {
    expect(list.map((course) => obstaclesOf(course.ground).length)).toEqual([3, 5, 7, 9, 11, 13]);
  });

  it('has the length and obstacle count of levelPlans', () => {
    for (const course of list) {
      expect(course.ground.length, course.id).toBe(levelPlans[course.id]!.length);
      expect(obstaclesOf(course.ground).length, course.id).toBe(levelPlans[course.id]!.obstacles);
    }
  });

  it('holds gaps only in r01 and r02', () => {
    for (const id of ['r01', 'r02']) {
      const ground = list.find((course) => course.id === id)!.ground;
      expect(ground.replace(/[_.G]/g, ''), id).toBe('');
    }
  });

  it('holds no posts in r03 and r04', () => {
    for (const id of ['r03', 'r04']) {
      const ground = list.find((course) => course.id === id)!.ground;
      expect(ground.includes('P'), id).toBe(false);
    }
  });

  it('holds a post in r05 and r06, and a pumpkin in r03 to r06', () => {
    for (const id of ['r05', 'r06']) expect(list.find((course) => course.id === id)!.ground.includes('P'), id).toBe(true);
    for (const id of ['r03', 'r04', 'r05', 'r06']) expect(list.find((course) => course.id === id)!.ground.includes('p'), id).toBe(true);
  });

  it('has at least one candle in every course', () => {
    for (const course of list) expect(`${course.air1}${course.air2}`.includes('c'), course.id).toBe(true);
  });
});

describe('runChecks on the shipped courses', () => {
  it.each(ids)('passes every check for %s', { timeout: 120000 }, (id) => {
    const def = runnerDef as unknown as GameDef<Json, unknown>;
    const solved = solveTick(def, id, 1);
    expect(solved.solved, id).toBe(true);
    const checks = runChecks(def, id, solved, tools, levelPlans[id]!);
    expect(checks.map((check) => check.name)).toEqual(['length_ok', 'finishable', 'spacing_ok', 'window_ok']);
    expect(checks.filter((check) => !check.passed).map((check) => `${check.name}: ${check.detail}`)).toEqual([]);
  });
});

describe('candles', () => {
  /**
   * Every state that is alive and from which the gate can still be reached, by tick. A candle does not change the
   * motion, so the course is searched without candles and each candle is tried on those states.
   */
  function winningStates(course: RawCourse): RunnerState[] {
    const def = makeRunnerDef([{ ...course, air1: '.'.repeat(course.air1.length), air2: '.'.repeat(course.air2.length) }]);
    const layers: Map<string, { state: RunnerState; next: string[] }>[] = [new Map()];
    const start = def.init(course.id, 1);
    layers[0]!.set(hashState(start as unknown as Json), { state: start, next: [] });
    const winning = new Set<string>();
    for (let tick = 0; layers[tick]!.size > 0; tick++) {
      const layer = layers[tick]!;
      const following = new Map<string, { state: RunnerState; next: string[] }>();
      for (const entry of layer.values()) {
        for (const action of def.actions(entry.state)) {
          const state = step(entry.state, action);
          if (state.phase === 'lost') continue;
          const hash = hashState(state as unknown as Json);
          entry.next.push(hash);
          if (state.phase === 'won') winning.add(hash);
          else if (!following.has(hash)) following.set(hash, { state, next: [] });
        }
      }
      layers.push(following);
    }
    const out: RunnerState[] = [];
    for (let tick = layers.length - 1; tick >= 0; tick--) {
      for (const [hash, entry] of layers[tick]!) {
        if (tick === layers.length - 1 && entry.next.length === 0 && !winning.has(hash)) continue;
        if (entry.next.some((next) => winning.has(next))) {
          winning.add(hash);
          out.push(entry.state);
        }
      }
    }
    return out;
  }

  it.each(ids)('lets a jump on a winning run take every candle of %s', { timeout: 120000 }, (id) => {
    const course = list.find((item) => item.id === id)!;
    const states = winningStates(course);
    const def = makeRunnerDef([course]);
    const indexes = [...course.air1].flatMap((char, column) => (char === 'c' ? [column] : [])).concat([...course.air2].flatMap((char, column) => (char === 'c' ? [column + 1000] : [])));
    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) {
      const column = index % 1000;
      const taken = states.some((state) => {
        if (Math.abs(state.x - column * 512) > 1500) return false;
        return def.actions({ ...state, candles: [index] }).some((action) => {
          const next = step({ ...state, candles: [index] }, action);
          return next.phase !== 'lost' && next.score > state.score;
        });
      });
      expect(taken, `${id} candle ${index}`).toBe(true);
    }
  });
});
