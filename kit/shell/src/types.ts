import type { Replay } from '@kit/core';

export type InputEvent = { type: 'pointer'; itemIds: string[] } | { type: 'key'; key: string };

// The anchor is a scene item id or a button id. The text has at most 2 words.
export interface Lesson { id: string; anchor: string; text: string }
export interface InputButton { id: string; label: string; action: string }

export interface InputMap<S> {
  // The action of a tick that has no input. Null for a turn game.
  idle: string | null;
  toAction(event: InputEvent, state: S): string | null;
  // Play strip buttons that each apply one action.
  buttons: InputButton[];
  // The item or button an action is about, for the watch pointer mark.
  anchorFor(actionText: string): string | null;
  // At most 4.
  lessons: Lesson[];
  // One line for each key, such as "Space: wait". The how to play screen lists them.
  keys?: string[];
  // The reason a play strip action cannot be used in this state, such as "Pick a piece first", or null.
  // The play screen shows it beside the button when the button is pressed.
  refused?(actionText: string, state: S): string | null;
}

export interface GameTexts<S> {
  // status.reason to the text of the results screen.
  reasons: Record<string, string>;
  // Required for a tick game.
  tickStars?(start: S, end: S): 1 | 2 | 3;
  // Required for a tick game.
  fairTicks?(levelId: string): number | null;
}

// The file that `npm run prove` writes. The shape is the one in kit/solver/src/prove.ts.
export interface ProofFile {
  format: 1;
  game: string;
  kind: 'turn' | 'tick';
  level: string;
  rulesVersion: string;
  seed: number;
  checks: { name: string; passed: boolean; detail: string }[];
  // Actions are run length text such as "wait*2".
  replay: Replay;
  stats: { actions: number; nodes: number };
}
export interface ProofIndex {
  game: string;
  levels: { id: string; actions: number; firstMoves?: { legal: number; winning: number } }[];
}
export interface ProofSet {
  loadIndex(): Promise<ProofIndex>;
  load(levelId: string): Promise<ProofFile>;
}
