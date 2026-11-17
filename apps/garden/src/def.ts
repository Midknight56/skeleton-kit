import type { GameDef } from '@kit/core';
import { gameConfig } from '../game.config';
import levelsJson from './levels/levels.json';
import { parseLevel, type RawLevel } from './rules/level';
import { observe } from './rules/observe';
import type { GardenState } from './rules/state';
import { actions, decodeAction, encodeAction, status, step, type GardenAction } from './rules/step';
import { view } from './view/scene';

/** Builds the game definition from a list of levels. Tests and the proof tests use it with their own levels. */
export function makeGardenDef(levels: RawLevel[]): GameDef<GardenState, GardenAction> {
  return {
    id: 'garden',
    title: gameConfig.title,
    rulesVersion: '1',
    kind: 'turn',
    levels: () => levels.map((level) => ({ id: level.id, title: level.title })),
    init(levelId) {
      const raw = levels.find((level) => level.id === levelId);
      if (raw === undefined) throw new Error(`The level "${levelId}" does not exist.`);
      const parsed = parseLevel(raw);
      if (!parsed.ok) throw new Error(`The level "${levelId}" has problems: ${parsed.problems.join(' ')}`);
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

export default makeGardenDef(levelsJson);
