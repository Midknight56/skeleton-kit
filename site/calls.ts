// The calls of the landing page. They are built from the proof file of one level and only name the five
// tools of the tool door (see docs/tool-door.md). A response is shown only when the proof file holds it.
import { LANDING_LEFT_MESSAGE, LANDING_MESSAGE } from './landing-message';

export const TOOLS = ['new_game', 'act', 'observe', 'render', 'replay'] as const;
export type ToolName = (typeof TOOLS)[number];

export interface ProofFile {
  level: string;
  seed: number;
  replay: { actions: string[]; finalHash?: string; finalPhase?: string };
}

export interface Call {
  name: ToolName;
  input: unknown;
  // What the tool answers, as far as the proof file shows it.
  response?: string;
}

// A run length item is text such as "wait*2". The proof files hold actions in this form.
export function expand(items: string[]): string[] {
  return items.flatMap((item) => {
    const match = /^(.*)\*(\d+)$/.exec(item);
    return match ? Array.from({ length: Number(match[2]) }, () => match[1] as string) : [item];
  });
}

export function buildCalls(proof: ProofFile): Call[] {
  const actions = expand(proof.replay.actions);
  const { finalHash, finalPhase } = proof.replay;
  const known = typeof finalHash === 'string' && typeof finalPhase === 'string';
  const act: Call = { name: 'act', input: { session: 's1', actions } };
  const replay: Call = { name: 'replay', input: { session: 's1' } };
  if (known) {
    act.response = `applied ${actions.length}, phase "${finalPhase}", hash ${finalHash}`;
    replay.response = `finalPhase "${finalPhase}", finalHash ${finalHash}`;
  }
  return [{ name: 'new_game', input: { level: proof.level, seed: proof.seed } }, act, replay];
}

// Which of the three calls runs, from the number of actions the watch screen has applied.
export function runningIndex(applied: number, total: number): 0 | 1 | 2 {
  if (applied <= 0) return 0;
  return applied >= total ? 2 : 1;
}

export interface Progress { applied: number; total: number; round: number }

// Reads the message of the watch screen. Anything that does not fit gives null.
export function readProgress(data: unknown): Progress | null {
  if (data === null || typeof data !== 'object') return null;
  const m = data as Record<string, unknown>;
  if (m.type !== LANDING_MESSAGE) return null;
  const { applied, total, round } = m;
  if (typeof applied !== 'number' || typeof total !== 'number' || typeof round !== 'number') return null;
  if (!Number.isInteger(applied) || !Number.isInteger(total) || !Number.isInteger(round)) return null;
  if (total < 1 || applied < 0 || applied > total) return null;
  return { applied, total, round };
}

/** True for the message that says the frame left the watch screen. */
export function isWatchLeft(data: unknown): boolean {
  return data !== null && typeof data === 'object' && (data as Record<string, unknown>).type === LANDING_LEFT_MESSAGE;
}

/** The level id of a watch message, or null. */
export function readLevel(data: unknown): string | null {
  if (data === null || typeof data !== 'object') return null;
  const m = data as Record<string, unknown>;
  return m.type === LANDING_MESSAGE && typeof m.level === 'string' ? m.level : null;
}