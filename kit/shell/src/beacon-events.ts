// The usage beacon: every event and every field it may carry. Plain data.
// `beacon.ts` and the privacy page both read this list. Nothing else is ever sent.
export type BeaconEventName = 'open' | 'level_start' | 'watch_start' | 'watch_end' | 'level_end';
export type BeaconField = 'game' | 'level' | 'result';
// The values of the field `result`. `left` means the player left a level before it was won or lost.
export type BeaconResult = 'won' | 'lost' | 'left';
export const BEACON_RESULTS: BeaconResult[] = ['won', 'lost', 'left'];

export interface BeaconEventSpec {
  event: BeaconEventName;
  fields: BeaconField[];
  // Plain words for the privacy page.
  says: string;
}

export const BEACON_EVENTS: BeaconEventSpec[] = [
  { event: 'open', fields: ['game'], says: 'The page was opened.' },
  { event: 'level_start', fields: ['game', 'level'], says: 'A level was started.' },
  { event: 'watch_start', fields: ['game', 'level'], says: 'The watch mode was started on a level.' },
  { event: 'watch_end', fields: ['game', 'level'], says: 'The watch mode stopped. The replay came to its end or the player left the watch screen.' },
  { event: 'level_end', fields: ['game', 'level', 'result'], says: 'A level ended. The result is won, lost or left. Left means the player left the level before it was won or lost.' },
];
