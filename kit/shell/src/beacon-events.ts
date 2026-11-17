// The usage beacon: every event and every field it may carry. Plain data.
// `beacon.ts` and the privacy page both read this list. Nothing else is ever sent.
export type BeaconEventName = 'open' | 'level_start' | 'watch_start' | 'level_end';
export type BeaconField = 'game' | 'level' | 'result';

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
  { event: 'level_end', fields: ['game', 'level', 'result'], says: 'A level ended. The result is won or lost.' },
];
