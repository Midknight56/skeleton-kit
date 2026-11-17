import { KitError, type GameDef } from '@kit/core';
import { gameConfig } from '../game.config';
import { LEVELS } from './levels/levels';
import { observe } from './rules/observe';
import { SIZE, type LampAction, type LampState } from './rules/state';
import { actions, decodeAction, encodeAction, flip, status, step } from './rules/step';
import { view } from './view/scene';

const def: GameDef<LampState, LampAction> = {
  id: 'lights',
  title: gameConfig.title,
  rulesVersion: '1',
  kind: 'turn',
  levels: () => LEVELS.map((level) => ({ id: level.id, title: level.title })),
  init(levelId) {
    const level = LEVELS.find((item) => item.id === levelId);
    if (level === undefined) throw new KitError('unknown_level', `Unknown level ${levelId}`);
    let lamps = new Array<number>(SIZE * SIZE).fill(0);
    for (const press of level.presses) lamps = flip(lamps, press);
    return { lamps, moves: 0 };
  },
  actions,
  step,
  status,
  observe,
  view,
  encodeAction,
  decodeAction,
};

export default def;
