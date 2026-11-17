import type { ProgressStore } from './storage';
import type { SoundName, SoundRecipe, Theme } from './theme';

export interface AudioContextLike {
  currentTime: number;
  destination: unknown;
  state: string;
  resume(): unknown;
  createGain(): { gain: { value: number }; connect(node: unknown): void };
  createOscillator(): {
    type: string;
    frequency: { value: number };
    connect(node: unknown): void;
    start(time: number): void;
    stop(time: number): void;
  };
}

export interface AudioOptions {
  theme: Theme;
  store: ProgressStore;
  makeContext?: () => AudioContextLike | null;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface GameAudio {
  // Call at the first tap or key. Before that no node exists and no sound plays.
  unlock(): void;
  play(name: SoundName): void;
  startMusic(): void;
  stopMusic(): void;
  setSound(on: boolean): void;
  setMusic(on: boolean): void;
  soundOn(): boolean;
  musicOn(): boolean;
}

function defaultContext(): AudioContextLike | null {
  const Ctor = (globalThis as { AudioContext?: new () => AudioContextLike }).AudioContext;
  try {
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

function recipeMs(recipe: SoundRecipe): number {
  return recipe.notes.reduce((sum, n) => sum + n.ms, 0);
}

// Every sound is made in code from the recipes of the theme. Failures are silent.
export function createAudio(options: AudioOptions): GameAudio {
  const makeContext = options.makeContext ?? defaultContext;
  const setTimer = options.setTimer ?? ((cb: () => void, ms: number) => setTimeout(cb, ms));
  const clearTimer = options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const { store, theme } = options;
  let ctx: AudioContextLike | null = null;
  let musicRunning = false;
  let loopTimer: unknown = null;

  function schedule(recipe: SoundRecipe): void {
    if (!ctx) return;
    try {
      let at = ctx.currentTime;
      for (const note of recipe.notes) {
        const gain = ctx.createGain();
        gain.gain.value = recipe.gain;
        const osc = ctx.createOscillator();
        osc.type = recipe.wave;
        osc.frequency.value = note.hz;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        at += note.ms / 1000;
        osc.stop(at);
      }
    } catch {
      // Audio failure is silent.
    }
  }

  function loop(): void {
    if (!musicRunning) return;
    schedule(theme.music);
    const ms = recipeMs(theme.music);
    if (ms > 0) loopTimer = setTimer(loop, ms);
  }

  const self: GameAudio = {
    unlock() {
      if (!ctx) {
        ctx = makeContext();
        if (!ctx) return;
      }
      try {
        if (ctx.state === 'suspended') ctx.resume();
      } catch {
        // Silent.
      }
      self.startMusic();
    },
    play(name) {
      if (!ctx || !store.read().settings.sound) return;
      schedule(theme.sounds[name]);
    },
    startMusic() {
      if (!ctx || musicRunning || !store.read().settings.music) return;
      musicRunning = true;
      loop();
    },
    stopMusic() {
      musicRunning = false;
      if (loopTimer !== null) clearTimer(loopTimer);
      loopTimer = null;
    },
    setSound(on) {
      store.setSetting('sound', on);
    },
    setMusic(on) {
      store.setSetting('music', on);
      if (on) self.startMusic();
      else self.stopMusic();
    },
    soundOn: () => store.read().settings.sound,
    musicOn: () => store.read().settings.music,
  };
  return self;
}
