import { createSession } from '@kit/core';
import type { GameDef, Json, Scene, Session, Status, Viewport } from '@kit/core';
import { itemIdsAt, scaleHud } from './painter';
import type { InputEvent, InputMap } from './types';

// Every level starts with seed 1, the seed of the prover, so a proof replay is valid here.
export const LEVEL_SEED = 1;
const MAX_TICKS_PER_FRAME = 5;

export interface PlayOptions<S extends Json, A> {
  def: GameDef<S, A>;
  input: InputMap<S>;
  levelId: string;
  // The play area: the page without the strip.
  viewport: Viewport;
  // How many times larger the hud text is drawn. Default 1. The game's own scene is not changed.
  hudScale?: number;
  // Called once when the phase leaves `playing`.
  onPhase?: (status: Status) => void;
  // Called for each applied action, with its text.
  onApplied?: (actionText: string) => void;
}

export interface PlayController<S extends Json, A> {
  readonly session: Session<S, A>;
  // A pointer at a point of the play area, in CSS px. Returns true when an action was applied or queued.
  pointer(x: number, y: number): boolean;
  // A key. While a button has focus, Space and Enter belong to the button. Every other key reaches the game.
  key(key: string, buttonFocused: boolean): boolean;
  // The action of a play strip button.
  press(actionText: string): boolean;
  undo(): boolean;
  // Adds a frame of dtMs milliseconds at speed 1 or 4. Returns the number of actions applied.
  frame(dtMs: number, speed?: number): number;
  scene(): Scene;
  // The play area can change when the window is resized or a paused level resumes.
  setViewport(viewport: Viewport): void;
  // Time owed, in units of ms times ticks per second. A tick is due at 1000.
  accumulator(): number;
  // The action the next tick will use, or null.
  pending(): string | null;
}

export function createPlay<S extends Json, A>(options: PlayOptions<S, A>): PlayController<S, A> {
  const { def, input } = options;
  let viewport = options.viewport;
  const session = createSession(def, options.levelId, LEVEL_SEED);
  const tps = def.ticksPerSecond ?? 60;
  let acc = 0;
  let pendingAction: string | null = null;
  let ended = session.status().phase !== 'playing';

  function afterApply(text: string): void {
    options.onApplied?.(text);
    const status = session.status();
    if (!ended && status.phase !== 'playing') {
      ended = true;
      options.onPhase?.(status);
    }
  }

  function applyNow(text: string): boolean {
    if (!session.legal().includes(text)) return false;
    const result = session.apply(text);
    if (!result.ok) return false;
    afterApply(text);
    return true;
  }

  // Turn game: apply at once. Tick game: keep the last legal action for the next tick.
  function submit(text: string | null): boolean {
    if (text === null) return false;
    if (session.status().phase !== 'playing') return false;
    if (def.kind === 'turn') return applyNow(text);
    if (!session.legal().includes(text)) return false;
    pendingAction = text;
    return true;
  }

  function event(e: InputEvent): boolean {
    return submit(input.toAction(e, session.state));
  }

  function scene(): Scene {
    return scaleHud(def.view(session.state, viewport), options.hudScale ?? 1, viewport.safe.top);
  }

  return {
    session,
    pointer(x, y) {
      if (x < 0 || y < 0 || x >= viewport.width || y >= viewport.height) return false;
      return event({ type: 'pointer', itemIds: itemIdsAt(scene(), x, y) });
    },
    key(key, buttonFocused) {
      if (buttonFocused && (key === ' ' || key === 'Enter')) return false;
      return event({ type: 'key', key });
    },
    press(actionText) {
      return submit(actionText);
    },
    undo() {
      // The end of a level is final: once the phase is not playing, there is nothing to undo.
      if (def.kind !== 'turn' || session.status().phase !== 'playing') return false;
      const done = session.undo();
      if (done) ended = session.status().phase !== 'playing';
      return done;
    },
    frame(dtMs, speed = 1) {
      if (def.kind !== 'tick' || session.status().phase !== 'playing') return 0;
      acc += dtMs * speed * tps;
      const limit = MAX_TICKS_PER_FRAME * speed;
      let applied = 0;
      while (acc >= 1000 && applied < limit && session.status().phase === 'playing') {
        const text = pendingAction !== null && session.legal().includes(pendingAction) ? pendingAction : input.idle;
        pendingAction = null;
        acc -= 1000;
        if (text !== null && applyNow(text)) applied += 1;
      }
      if (acc >= 1000) acc = 0;
      return applied;
    },
    scene,
    setViewport(next) {
      viewport = next;
    },
    accumulator: () => acc,
    pending: () => pendingAction,
  };
}
