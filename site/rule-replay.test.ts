import { describe, expect, it } from 'vitest';
import levelsJson from '../apps/garden/src/levels/levels.json';
import { Replayer, replayFrames, type Frame, type Timers } from './rule-replay';
import { tryLimit } from './try-rule';

// Task 1 of .kiro/specs/judge-rule-replay. The board replay uses real sessions on the in-memory copy of g03.

function fakeTimers(): Timers & { pending: Map<number, () => void>; fire: () => void } {
  let next = 1;
  const pending = new Map<number, () => void>();
  return {
    pending,
    set: (fn) => {
      pending.set(next, fn);
      return next++;
    },
    clear: (id) => void pending.delete(id as number),
    fire: () => {
      const [id, fn] = [...pending][0]!;
      pending.delete(id);
      fn();
    },
  };
}

describe('the board replay of the rule try out', () => {
  it('limit 4 plays the solver actions to a win with the hash of the solver', () => {
    const result = tryLimit(4);
    expect(result.kind).toBe('won');
    if (result.kind !== 'won') return;
    const frames = replayFrames(4, result.actions);
    expect(frames).toHaveLength(result.actions.length + 1);
    expect(frames.map((f) => f.action)).toEqual([null, ...result.actions]);
    expect(frames[0]!.phase).toBe('playing');
    expect(frames[0]!.svg).toContain('<svg');
    const last = frames[frames.length - 1]!;
    expect(last.phase).toBe('won');
    expect(last.applied).toBe(result.count);
    expect(last.hash).toBe(result.hash);
    expect(new Set(frames.map((f) => f.hash)).size).toBe(frames.length);
  });

  it('limit 8 stays consistent with the shipped rules and leaves the shipped data alone', () => {
    const before = JSON.stringify(levelsJson);
    const result = tryLimit(8);
    if (result.kind !== 'won') throw new Error('expected a win');
    const frames = replayFrames(8, result.actions);
    expect(frames[frames.length - 1]!.hash).toBe('9a074fd5e9266b9a');
    expect(frames[0]!.svg).toContain('Turn 0 of 8');
    expect(JSON.stringify(levelsJson)).toBe(before);
  });

  it('refuses an action that is not legal', () => {
    expect(() => replayFrames(4, ['light:9'])).toThrow();
  });

  it('a new run cancels the timers of the old run', () => {
    const timers = fakeTimers();
    const replayer = new Replayer(timers);
    const frames = (n: number): Frame[] => Array.from({ length: 3 }, (_, i) => ({ applied: i, total: 2, action: null, hash: `${n}`, phase: 'playing', svg: '' }));
    const seen: string[] = [];
    replayer.start(frames(1), (f) => seen.push(`a${f.applied}`));
    timers.fire();
    replayer.start(frames(2), (f) => seen.push(`b${f.applied}`));
    expect(timers.pending.size).toBe(1);
    timers.fire();
    timers.fire();
    expect(seen).toEqual(['a0', 'a1', 'b0', 'b1', 'b2']);
    replayer.start(frames(3), (f) => seen.push(`c${f.applied}`));
    replayer.stop();
    expect(timers.pending.size).toBe(0);
    expect(seen).not.toContain('c1');
  });

  it('switching 3, 4, restore, many times keeps the answers the same', () => {
    for (let i = 0; i < 3; i++) {
      expect(tryLimit(3).kind).toBe('lost');
      const four = tryLimit(4);
      const eight = tryLimit(8);
      expect(four.kind === 'won' && four.count).toBe(4);
      expect(eight.kind === 'won' && eight.hash).toBe('9a074fd5e9266b9a');
    }
  });

  it('bad input gives an error and never a replay', () => {
    for (const bad of [0, 21, 2.5, Number.NaN, -3]) expect(tryLimit(bad).kind).toBe('error');
  });
});