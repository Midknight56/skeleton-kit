export interface LevelProgress { stars: number; best: number }
export interface StoredData {
  version: 1;
  levels: Record<string, LevelProgress>;
  settings: { sound: boolean; music: boolean; usage: boolean };
  lessons: Record<string, number>;
}

export interface ProgressStore {
  // False when the browser storage is blocked and the memory store is in use.
  readonly persistent: boolean;
  read(): StoredData;
  // kind 'turn': a lower best is better. kind 'tick': a higher best is better. Stars only rise.
  recordResult(levelId: string, result: LevelProgress, kind: 'turn' | 'tick'): void;
  isFinished(levelId: string): boolean;
  setSetting(name: 'sound' | 'music' | 'usage', value: boolean): void;
  lessonCount(lessonId: string): number;
  bumpLesson(lessonId: string): void;
  reset(): void;
}

export function storageKey(gameId: string): string {
  return `kit.${gameId}.v1`;
}

function empty(): StoredData {
  return { version: 1, levels: {}, settings: { sound: true, music: true, usage: true }, lessons: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Returns null for a text that does not parse or has another version.
function parse(text: string | null): StoredData | null {
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw.version !== 1) return null;
  const data = empty();
  if (isRecord(raw.levels)) {
    for (const [id, v] of Object.entries(raw.levels)) {
      if (isRecord(v) && typeof v.stars === 'number' && typeof v.best === 'number') data.levels[id] = { stars: v.stars, best: v.best };
    }
  }
  if (isRecord(raw.settings)) {
    if (typeof raw.settings.sound === 'boolean') data.settings.sound = raw.settings.sound;
    if (typeof raw.settings.music === 'boolean') data.settings.music = raw.settings.music;
    if (typeof raw.settings.usage === 'boolean') data.settings.usage = raw.settings.usage;
  }
  if (isRecord(raw.lessons)) {
    for (const [id, n] of Object.entries(raw.lessons)) if (typeof n === 'number') data.lessons[id] = n;
  }
  return data;
}

// backend null means no storage at all. A backend that throws switches to memory.
export function createStore(gameId: string, backend: Storage | null): ProgressStore {
  const key = storageKey(gameId);
  let persistent = backend !== null;
  let memory: StoredData = empty();

  function load(): StoredData {
    if (persistent && backend) {
      try {
        return parse(backend.getItem(key)) ?? empty();
      } catch {
        persistent = false;
        return memory;
      }
    }
    return memory;
  }

  function save(data: StoredData): void {
    memory = data;
    if (persistent && backend) {
      try {
        backend.setItem(key, JSON.stringify(data));
      } catch {
        persistent = false;
      }
    }
  }

  return {
    get persistent() {
      return persistent;
    },
    read: () => structuredClone(load()),
    recordResult(levelId, result, kind) {
      const data = load();
      const old = data.levels[levelId];
      if (!old) {
        data.levels[levelId] = { stars: result.stars, best: result.best };
      } else {
        const better = kind === 'turn' ? Math.min(old.best, result.best) : Math.max(old.best, result.best);
        data.levels[levelId] = { stars: Math.max(old.stars, result.stars), best: better };
      }
      save(data);
    },
    isFinished: (levelId) => (load().levels[levelId]?.stars ?? 0) >= 1,
    setSetting(name, value) {
      const data = load();
      data.settings[name] = value;
      save(data);
    },
    lessonCount: (lessonId) => load().lessons[lessonId] ?? 0,
    bumpLesson(lessonId) {
      const data = load();
      data.lessons[lessonId] = (data.lessons[lessonId] ?? 0) + 1;
      save(data);
    },
    reset() {
      // The usage data switch is a privacy choice, not progress, so a reset keeps it.
      const fresh = empty();
      fresh.settings.usage = load().settings.usage;
      save(fresh);
    },
  };
}
