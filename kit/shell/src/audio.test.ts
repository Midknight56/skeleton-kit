// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAudio, type AudioContextLike } from './audio';
import { createStore } from './storage';
import { neutralTheme } from './test-theme';

interface Osc { type: string; hz: number; start: number; stop: number; gain: number }

class FakeContext implements AudioContextLike {
  currentTime = 10;
  destination = {};
  state = 'running';
  oscillators: Osc[] = [];
  gains = 0;
  resume = () => undefined;
  createGain() {
    this.gains += 1;
    const gain = { gain: { value: 1 }, connect: () => undefined };
    this.lastGain = gain;
    return gain;
  }
  lastGain: { gain: { value: number } } | null = null;
  createOscillator() {
    const gainNode = this.lastGain;
    const record: Osc = { type: '', hz: 0, start: -1, stop: -1, gain: gainNode?.gain.value ?? -1 };
    this.oscillators.push(record);
    return {
      set type(v: string) { record.type = v; },
      get type() { return record.type; },
      frequency: {
        set value(v: number) { record.hz = v; },
        get value() { return record.hz; },
      },
      connect: () => undefined,
      start: (t: number) => { record.start = t; },
      stop: (t: number) => { record.stop = t; },
    };
  }
}

function setup(theme = neutralTheme()) {
  const contexts: FakeContext[] = [];
  const timers: { cb: () => void; ms: number; id: number; live: boolean }[] = [];
  const store = createStore('game-a', localStorage);
  const audio = createAudio({
    theme,
    store,
    makeContext: () => {
      const c = new FakeContext();
      contexts.push(c);
      return c;
    },
    setTimer: (cb, ms) => {
      timers.push({ cb, ms, id: timers.length, live: true });
      return timers.length - 1;
    },
    clearTimer: (id) => {
      const t = timers[id as number];
      if (t) t.live = false;
    },
  });
  return { audio, contexts, timers, store };
}

beforeEach(() => {
  localStorage.clear();
});

describe('audio start', () => {
  it('makes no context and no node before the first input', () => {
    const { audio, contexts } = setup();
    audio.play('tap');
    audio.startMusic();
    expect(contexts.length).toBe(0);
  });

  it('makes the context at the first input', () => {
    const { audio, contexts } = setup();
    audio.unlock();
    audio.unlock();
    expect(contexts.length).toBe(1);
  });
});

describe('sounds from recipes', () => {
  it('plays the notes of a recipe in order, one oscillator for each note', () => {
    const theme = neutralTheme();
    theme.sounds.win = { wave: 'triangle', notes: [{ hz: 300, ms: 100 }, { hz: 400, ms: 200 }], gain: 0.3 };
    const { audio, contexts } = setup(theme);
    audio.unlock();
    audio.stopMusic();
    audio.play('win');
    const oscs = contexts[0]!.oscillators.filter((o) => o.type === 'triangle');
    expect(oscs.map((o) => o.hz)).toEqual([300, 400]);
    expect(oscs[0]!.start).toBeCloseTo(10, 5);
    expect(oscs[0]!.stop).toBeCloseTo(10.1, 5);
    expect(oscs[1]!.start).toBeCloseTo(10.1, 5);
    expect(oscs[1]!.stop).toBeCloseTo(10.3, 5);
    expect(oscs[0]!.gain).toBeCloseTo(0.3, 5);
  });

  it('plays nothing when sound is off', () => {
    const theme = neutralTheme();
    theme.sounds.tap = { wave: 'square', notes: [{ hz: 500, ms: 50 }], gain: 0.1 };
    const { audio, contexts } = setup(theme);
    audio.setSound(false);
    audio.unlock();
    audio.stopMusic();
    audio.play('tap');
    expect(contexts[0]!.oscillators.filter((o) => o.type === 'square')).toEqual([]);
  });
});

describe('the two switches', () => {
  it('are on at first and saved when changed', () => {
    const { audio, store } = setup();
    expect(audio.soundOn()).toBe(true);
    expect(audio.musicOn()).toBe(true);
    audio.setSound(false);
    audio.setMusic(false);
    expect(store.read().settings).toEqual({ sound: false, music: false });
  });

  it('are kept by the next audio object on the same storage', () => {
    const first = setup();
    first.audio.setSound(false);
    first.audio.setMusic(false);
    const second = setup();
    expect(second.audio.soundOn()).toBe(false);
    expect(second.audio.musicOn()).toBe(false);
  });
});

describe('music', () => {
  const loopTheme = () => {
    const theme = neutralTheme();
    theme.music = { wave: 'sine', notes: [{ hz: 200, ms: 250 }, { hz: 300, ms: 250 }], gain: 0.05 };
    return theme;
  };

  it('starts at the first input when the music switch is on and plays the music recipe', () => {
    const { audio, contexts } = setup(loopTheme());
    audio.unlock();
    expect(contexts[0]!.oscillators.map((o) => o.hz)).toEqual([200, 300]);
  });

  it('loops: when the recipe time has passed it plays the recipe again', () => {
    const { audio, contexts, timers } = setup(loopTheme());
    audio.unlock();
    expect(timers.length).toBe(1);
    expect(timers[0]!.ms).toBe(500);
    timers[0]!.cb();
    expect(contexts[0]!.oscillators.map((o) => o.hz)).toEqual([200, 300, 200, 300]);
    expect(timers.length).toBe(2);
  });

  it('stops looping when the music switch goes off', () => {
    const { audio, contexts, timers } = setup(loopTheme());
    audio.unlock();
    audio.setMusic(false);
    expect(timers[0]!.live).toBe(false);
    const before = contexts[0]!.oscillators.length;
    timers[0]!.cb();
    expect(contexts[0]!.oscillators.length).toBe(before);
  });

  it('starts again when the switch goes back on', () => {
    const { audio, contexts } = setup(loopTheme());
    audio.unlock();
    audio.setMusic(false);
    audio.setMusic(true);
    expect(contexts[0]!.oscillators.length).toBe(4);
  });

  it('does not start when the switch is off at the first input', () => {
    const { audio, contexts } = setup(loopTheme());
    audio.setMusic(false);
    audio.unlock();
    expect(contexts[0]!.oscillators.length).toBe(0);
  });
});

describe('no sound file', () => {
  it('has no Audio element, no fetch and no file name in the source', () => {
    const text = readFileSync(join(process.cwd(), 'kit', 'shell', 'src', 'audio.ts'), 'utf8');
    expect(text).not.toMatch(/new Audio\(|fetch\(|\.(mp3|wav|ogg)\b/);
  });
});
