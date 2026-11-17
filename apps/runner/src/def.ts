import type { GameDef } from '@kit/core';
import { gameConfig } from '../game.config';
import coursesJson from './levels/courses.json';
import { parseCourse } from './rules/course';
import { observe } from './rules/observe';
import type { RawCourse, RunnerState } from './rules/state';
import { actions, decodeAction, encodeAction, status, step, type RunnerAction } from './rules/step';
import { view } from './view/scene';
import { TPS } from './rules/constants';

/** Builds the game definition from a list of courses. Tests and the proof tests use it with their own courses. */
export function makeRunnerDef(courses: RawCourse[]): GameDef<RunnerState, RunnerAction> {
  return {
    id: 'runner',
    title: gameConfig.title,
    rulesVersion: '1',
    kind: 'tick',
    ticksPerSecond: TPS,
    levels: () => courses.map((course) => ({ id: course.id, title: course.title })),
    init(levelId) {
      const raw = courses.find((course) => course.id === levelId);
      if (raw === undefined) throw new Error(`The course "${levelId}" does not exist.`);
      const parsed = parseCourse(raw);
      if (!parsed.ok) throw new Error(`The course "${levelId}" has problems: ${parsed.problems.join(' ')}`);
      return parsed.state;
    },
    actions,
    step,
    status,
    observe,
    view,
    encodeAction,
    decodeAction,
  };
}

export default makeRunnerDef(coursesJson);
