// The board replay of the landing page try out. It plays the actions that the search found on the in-memory
// copy of g03, with real sessions and the real scene of the garden puzzle. It reads no file, calls no network
// and writes no storage. A new run cancels the old one, so a late timer never draws.
import { createSession, paintSvg, type Json, type Viewport } from '@kit/core';
import { copyDef, LEVEL } from './try-rule';

export const VIEWPORT: Viewport = { width: 400, height: 300, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
export const STEP_MS = 700;

export interface Frame {
  applied: number;
  total: number;
  action: string | null;
  hash: string;
  phase: string;
  svg: string;
}

/** One frame for the start board and one after each action, from a real session on the copy with this limit. */
export function replayFrames(limit: number, actions: string[], sprites: Record<string, string> = {}): Frame[] {
  const def = copyDef(limit);
  const session = createSession(def, LEVEL, 1);
  const frame = (applied: number, action: string | null): Frame => ({
    applied,
    total: actions.length,
    action,
    hash: session.hash(),
    phase: session.status().phase,
    svg: paintSvg(def.view(session.state as Json, VIEWPORT), { sprites }),
  });
  const frames = [frame(0, null)];
  actions.forEach((action, index) => {
    const result = session.apply(action);
    if (!result.ok) throw new Error(`The action "${action}" was refused: ${result.message}`);
    frames.push(frame(index + 1, action));
  });
  return frames;
}

export interface Timers {
  set: (fn: () => void, ms: number) => unknown;
  clear: (id: unknown) => void;
}

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** Shows frames one after the other. `start` and `stop` both cancel the run before it. */
export class Replayer {
  private id: unknown = null;
  private run = 0;
  constructor(private readonly timers: Timers = realTimers) {}

  start(frames: Frame[], show: (frame: Frame) => void, stepMs = STEP_MS): void {
    this.stop();
    const run = this.run;
    const at = (index: number): void => {
      if (run !== this.run) return;
      const frame = frames[index];
      if (!frame) return;
      show(frame);
      if (index + 1 < frames.length) this.id = this.timers.set(() => at(index + 1), stepMs);
    };
    at(0);
  }

  stop(): void {
    this.run += 1;
    if (this.id !== null) this.timers.clear(this.id);
    this.id = null;
  }
}
