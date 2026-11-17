import type { GameTexts } from '@kit/shell';
import type { LampState } from './rules/state';

// A turn game has no tickStars and no fairTicks. This game has no end reason, because a level can only be won.
export const gameTexts: GameTexts<LampState> = {
  reasons: {},
};
