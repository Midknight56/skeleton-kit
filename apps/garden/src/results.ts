import type { GameTexts } from '@kit/shell';
import type { GardenState } from './rules/state';

// The garden puzzle is a turn game, so it has no tickStars and no fairTicks.
export const gardenTexts: GameTexts<GardenState> = {
  reasons: {
    web: 'Caught in a web',
    turns: 'Out of turns',
  },
};
