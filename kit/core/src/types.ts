export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Phase = 'playing' | 'won' | 'lost';
export interface LevelRef { id: string; title: string }
export interface Status { phase: Phase; score: number; reason?: string }

export interface Observation {
  summary: string; // one plain line, at most 120 characters
  textMap?: string[]; // rows of equal length, one character for each cell
  legend?: Record<string, string>; // meaning of each character in textMap
  facts: Record<string, Json>; // named values a tool can rely on
}

export interface Viewport {
  width: number;
  height: number;
  safe: { top: number; right: number; bottom: number; left: number };
}

export type Layer = 'back' | 'world' | 'actors' | 'fx' | 'hud';
export type SceneItem =
  | { kind: 'rect'; id: string; layer: Layer; x: number; y: number; w: number; h: number; fill: string; radius?: number; opacity?: number }
  | { kind: 'circle'; id: string; layer: Layer; cx: number; cy: number; r: number; fill: string; opacity?: number }
  | { kind: 'sprite'; id: string; layer: Layer; x: number; y: number; w: number; h: number; sprite: string; flipX?: boolean; opacity?: number }
  | { kind: 'text'; id: string; layer: Layer; x: number; y: number; text: string; size: number; fill: string; align: 'left' | 'center' | 'right' };
export interface Scene { width: number; height: number; items: SceneItem[] }

export interface GameDef<S extends Json, A> {
  id: string;
  title: string;
  rulesVersion: string;
  kind: 'turn' | 'tick';
  ticksPerSecond?: number;
  levels(): LevelRef[];
  init(levelId: string, seed: number): S;
  actions(state: S): A[];
  step(state: S, action: A): S;
  status(state: S): Status;
  observe(state: S): Observation;
  view(state: S, viewport: Viewport): Scene;
  encodeAction(action: A): string;
  decodeAction(text: string): A | null;
}

export interface Replay {
  format: 1;
  game: string;
  rulesVersion: string;
  level: string;
  seed: number;
  actions: string[];
  finalHash: string;
  finalPhase: Phase;
}

export type ApplyResult =
  | { ok: true; hash: string; status: Status }
  | { ok: false; error: 'bad_action_text' | 'illegal_action' | 'game_over'; message: string };

export interface Session<S extends Json, A> {
  readonly def: GameDef<S, A>;
  readonly level: string;
  readonly seed: number;
  readonly state: S;
  readonly tick: number;
  legal(): string[];
  apply(actionText: string): ApplyResult;
  undo(): boolean;
  status(): Status;
  hash(): string;
  toReplay(): Replay;
}

export type ReplayResult =
  | { ok: true; finalHash: string; finalPhase: Phase }
  | {
      ok: false;
      error:
        | 'wrong_game'
        | 'rules_changed'
        | 'unknown_level'
        | 'bad_seed'
        | 'bad_action_text'
        | 'illegal_action'
        | 'game_over'
        | 'hash_mismatch'
        | 'phase_mismatch';
      mismatchAt?: number;
      message: string;
    };
