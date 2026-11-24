// The watch screen tells the page that holds it (the landing page, in a frame) how far the run is.
// `applied` is the number of actions applied so far, `total` the number in the replay, `round` counts
// the restarts. The message holds no state of the game.
export const WATCH_MESSAGE = 'skeleton-kit:watch';

export interface WatchMessage {
  type: typeof WATCH_MESSAGE;
  level: string;
  applied: number;
  total: number;
  round: number;
}

export function watchMessage(level: string, applied: number, total: number, round: number): WatchMessage {
  return { type: WATCH_MESSAGE, level, applied, total, round };
}

// The watch screen also tells that page when it is left, so the page can stop saying that a level plays.
export const WATCH_LEFT_MESSAGE = 'skeleton-kit:watch-left';

export function watchLeftMessage(): { type: typeof WATCH_LEFT_MESSAGE } {
  return { type: WATCH_LEFT_MESSAGE };
}