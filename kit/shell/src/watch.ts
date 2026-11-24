import { createSession, expandActions, runReplay } from '@kit/core';
import type { GameDef, Json, LevelRef, Session } from '@kit/core';
import type { GameTexts, InputMap, ProofFile } from './types';

// A turn level shows the pointer mark for 400 ms, applies the action, and moves on after 800 ms.
export const WATCH_STEP_MS = 800;
export const WATCH_MARK_MS = 400;
export const WATCH_RESTART_MS = 3000;
// A tick level keeps the mark on screen this long after an action that has an anchor.
const TICK_MARK_MS = 250;
const MAX_TICKS_PER_FRAME = 5;

export type Verdict =
  | { kind: 'proved'; text: string }
  | { kind: 'stale'; text: string }
  | { kind: 'unproved' };

export interface PreparedProof { actions: string[]; verdict: Verdict }

// Reads `?watch=<levelId>` and returns the level id when the game has that level.
export function parseWatchParam(search: string, levels: LevelRef[]): string | null {
  const value = new URLSearchParams(search).get('watch');
  if (!value) return null;
  return levels.some((l) => l.id === value) ? value : null;
}

// Checks a proof file against the game: the replay must run through `runReplay` and end in won.
// Then the proved text is given only if every check of the file passed.
export function prepareProof<S extends Json, A>(def: GameDef<S, A>, texts: GameTexts<S>, proof: ProofFile): PreparedProof {
  const stale: PreparedProof = { actions: [], verdict: { kind: 'stale', text: 'This proof is out of date' } };
  let expanded: ReturnType<typeof expandActions>;
  try {
    expanded = expandActions(proof.replay.actions);
  } catch {
    return stale;
  }
  if (!expanded.ok) return stale;
  let result: ReturnType<typeof runReplay>;
  try {
    result = runReplay(def, proof.replay);
  } catch {
    return stale;
  }
  if (!result.ok || result.finalPhase !== 'won') return stale;
  const actions = expanded.actions;
  if (!proof.checks.every((c) => c.passed)) return { actions, verdict: { kind: 'unproved' } };
  if (def.kind === 'turn') return { actions, verdict: { kind: 'proved', text: `Proved in ${proof.stats.actions} actions` } };
  const ticks = texts.fairTicks?.(proof.level) ?? null;
  if (ticks === null) return { actions, verdict: { kind: 'unproved' } };
  return { actions, verdict: { kind: 'proved', text: `Proved: every jump has ${ticks} ticks or more` } };
}

export interface WatchOptions<S extends Json, A> {
  // Called after each action of the replay, with the state before and the state after.
  onApplied?(previous: S, state: S): void;
  def: GameDef<S, A>;
  input: InputMap<S>;
  texts: GameTexts<S>;
  proof: ProofFile;
}

export interface WatchController<S extends Json, A> {
  readonly session: Session<S, A>;
  readonly verdict: Verdict;
  frame(dtMs: number): void;
  setSpeed(speed: 1 | 4): void;
  speed(): 1 | 4;
  // The action about to be applied or just applied, and the item or button it is about.
  mark(): { action: string; anchor: string | null } | null;
  finished(): boolean;
  restarts(): number;
}

export function createWatch<S extends Json, A>(options: WatchOptions<S, A>): WatchController<S, A> {
  const { def, input, proof } = options;
  const prepared = prepareProof(def, options.texts, proof);
  const actions = prepared.actions;
  const runnable = prepared.verdict.kind !== 'stale';
  const tps = def.ticksPerSecond ?? 60;
  let session = createSession(def, proof.level, proof.replay.seed);
  let speed: 1 | 4 = 1;
  let index = 0;
  let clock = 0; // turn: ms since the slot start. tick: owed time in ms times ticks per second.
  let applied = false; // turn: the action of this slot was applied
  let done = !runnable;
  let restartClock = 0;
  let restartCount = 0;
  let tickMark: { action: string; anchor: string | null } | null = null;
  let tickMarkLeft = 0;

  function reset(): void {
    session = createSession(def, proof.level, proof.replay.seed);
    index = 0;
    clock = 0;
    applied = false;
    done = false;
    restartClock = 0;
    tickMark = null;
    tickMarkLeft = 0;
    restartCount += 1;
  }

  function applyAt(i: number): void {
    const before = session.state;
    session.apply(actions[i] as string);
    options.onApplied?.(before, session.state);
  }

  function turnFrame(dt: number): void {
    clock += dt * speed;
    for (;;) {
      if (!applied && clock >= WATCH_MARK_MS) {
        applyAt(index);
        applied = true;
        if (index >= actions.length - 1) {
          done = true;
          return;
        }
      }
      if (applied && clock >= WATCH_STEP_MS) {
        clock -= WATCH_STEP_MS;
        index += 1;
        applied = false;
        continue;
      }
      return;
    }
  }

  function tickFrame(dt: number): void {
    if (tickMarkLeft > 0) {
      tickMarkLeft -= dt;
      if (tickMarkLeft <= 0) tickMark = null;
    }
    clock += dt * speed * tps;
    const limit = MAX_TICKS_PER_FRAME * speed;
    let count = 0;
    while (clock >= 1000 && count < limit && !done) {
      const action = actions[index] as string;
      applyAt(index);
      index += 1;
      count += 1;
      clock -= 1000;
      const anchor = input.anchorFor(action);
      if (anchor !== null) {
        tickMark = { action, anchor };
        tickMarkLeft = TICK_MARK_MS;
      }
      if (index >= actions.length) done = true;
    }
    if (clock >= 1000) clock = 0;
  }

  return {
    get session() {
      return session;
    },
    verdict: prepared.verdict,
    frame(dt) {
      if (!runnable) return;
      if (done) {
        restartClock += dt;
        if (restartClock >= WATCH_RESTART_MS) reset();
        return;
      }
      if (def.kind === 'turn') turnFrame(dt);
      else tickFrame(dt);
    },
    setSpeed(next) {
      speed = next;
    },
    speed: () => speed,
    mark() {
      if (!runnable) return null;
      if (def.kind === 'tick') return tickMark;
      if (done || applied || index >= actions.length) return null;
      const action = actions[index] as string;
      const anchor = input.anchorFor(action);
      return anchor === null ? null : { action, anchor };
    },
    finished: () => done,
    restarts: () => restartCount,
  };
}
