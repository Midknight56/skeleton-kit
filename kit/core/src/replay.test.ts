import { describe, expect, it } from 'vitest';
import { runReplay } from './replay';
import { createSession } from './session';
import { hop, lights } from './test-fixtures';
import type { Replay } from './types';

const hopWin: Replay = (() => {
  const s = createSession(hop, 'h1', 5);
  for (const text of [...Array<string>(6).fill('none'), 'hop', ...Array<string>(32).fill('none')]) s.apply(text);
  return s.toReplay();
})();

describe('toReplay', () => {
  it('holds format, game, rules version, level, seed, compressed actions, hash and phase', () => {
    expect(hopWin.format).toBe(1);
    expect(hopWin.game).toBe('fixture-hop');
    expect(hopWin.rulesVersion).toBe('1');
    expect(hopWin.level).toBe('h1');
    expect(hopWin.seed).toBe(5);
    expect(hopWin.actions).toEqual(['none*6', 'hop', 'none*32']);
    expect(hopWin.finalPhase).toBe('won');
    expect(hopWin.finalHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('drops an undone action from the replay', () => {
    const s = createSession(lights, 'l2', 0);
    s.apply('press:0,0');
    s.apply('press:1,1');
    s.undo();
    expect(s.toReplay().actions).toEqual(['press:0,0']);
  });

  it('compresses a run of 3601 equal actions into two items', () => {
    const s = createSession(lights, 'l2', 0);
    for (let i = 0; i < 3601; i++) s.apply('press:0,0');
    const replay = s.toReplay();
    expect(replay.actions).toEqual(['press:0,0*3600', 'press:0,0']);
    expect(runReplay(lights, replay)).toEqual({ ok: true, finalHash: replay.finalHash, finalPhase: 'playing' });
  });
});

describe('runReplay', () => {
  it('accepts a good replay', () => {
    expect(runReplay(hop, hopWin)).toEqual({ ok: true, finalHash: hopWin.finalHash, finalPhase: 'won' });
  });

  it('accepts an unfinished run', () => {
    const s = createSession(lights, 'l3', 1);
    s.apply('press:0,0');
    const r = s.toReplay();
    expect(runReplay(lights, r)).toEqual({ ok: true, finalHash: r.finalHash, finalPhase: 'playing' });
  });

  it('reports game_over at the index of an action that follows the end', () => {
    // Without the hop the runner is lost on tick 10, so the action at index 10 follows the end.
    const result = runReplay(hop, { ...hopWin, actions: ['none*39'] });
    expect(result).toMatchObject({ ok: false, error: 'game_over', mismatchAt: 10 });
  });

  it('reports game_over for an undecodable text after the end', () => {
    const result = runReplay(lights, { ...replayOf(lights, 'l1', ['press:1,1']), actions: ['press:1,1', 'junk'] });
    expect(result).toMatchObject({ ok: false, error: 'game_over', mismatchAt: 1 });
  });

  it('reports hash_mismatch for a changed final hash', () => {
    const result = runReplay(hop, { ...hopWin, finalHash: '0000000000000000' });
    expect(result).toMatchObject({ ok: false, error: 'hash_mismatch' });
  });

  it('reports hash_mismatch when one action is changed but the run still ends the same way', () => {
    const r = replayOf(lights, 'l2', ['press:0,0', 'press:1,1']);
    const result = runReplay(lights, { ...r, actions: ['press:0,0', 'press:1,2'] });
    expect(result).toMatchObject({ ok: false, error: 'hash_mismatch' });
  });

  it('reports phase_mismatch for a changed final phase', () => {
    const result = runReplay(hop, { ...hopWin, finalPhase: 'lost' });
    expect(result).toMatchObject({ ok: false, error: 'phase_mismatch' });
  });

  it('reports wrong_game and rules_changed without running an action', () => {
    expect(runReplay(hop, { ...hopWin, game: 'other' })).toMatchObject({ ok: false, error: 'wrong_game' });
    expect(runReplay(hop, { ...hopWin, rulesVersion: '2' })).toMatchObject({ ok: false, error: 'rules_changed' });
    // The actions are junk, so any run would give another error.
    expect(runReplay(hop, { ...hopWin, game: 'other', actions: ['junk'] })).toMatchObject({ error: 'wrong_game' });
  });

  it('reports unknown_level and bad_seed', () => {
    expect(runReplay(hop, { ...hopWin, level: 'zz' })).toMatchObject({ ok: false, error: 'unknown_level' });
    for (const seed of [-1, 2147483648, 0.5, Number.NaN]) {
      expect(runReplay(hop, { ...hopWin, seed })).toMatchObject({ ok: false, error: 'bad_seed' });
    }
  });

  it('reports bad_action_text with the index after expansion', () => {
    const result = runReplay(hop, { ...hopWin, actions: ['none*3', 'skip'] });
    expect(result).toMatchObject({ ok: false, error: 'bad_action_text', mismatchAt: 3 });
  });

  it('reports illegal_action for a decodable action that is not listed', () => {
    const narrow = { ...lights, actions: (state: { lamps: number[]; moves: number }) => lights.actions(state).slice(0, 1) };
    const result = runReplay(narrow, { ...replayOf(lights, 'l2', []), game: narrow.id, actions: ['press:0,0', 'press:2,2'] });
    expect(result).toMatchObject({ ok: false, error: 'illegal_action', mismatchAt: 1 });
  });

  it.each(['none*', '*3', 'none*1', 'none*3601', 'none*x', 'none*2*2', 'none*0'])('reports bad_action_text for the item "%s"', (item) => {
    const result = runReplay(hop, { ...hopWin, actions: [item] });
    expect(result).toMatchObject({ ok: false, error: 'bad_action_text' });
  });

  it('does not throw for data that is not shaped like a replay', () => {
    const junk = { ...hopWin, actions: 'none' as unknown as string[] };
    expect(() => runReplay(hop, junk)).not.toThrow();
    expect(runReplay(hop, junk)).toMatchObject({ ok: false, error: 'bad_action_text' });
  });

  it('never throws on any of the failing cases above', () => {
    const cases: Replay[] = [
      { ...hopWin, game: 'x' },
      { ...hopWin, level: 'x' },
      { ...hopWin, seed: Number.NaN },
      { ...hopWin, actions: ['none*', 'hop*3601', '*', ''] },
      { ...hopWin, actions: ['none*39'] },
    ];
    for (const c of cases) expect(() => runReplay(hop, c)).not.toThrow();
  });
});

function replayOf(def: typeof lights, level: string, actions: string[]): Replay {
  const s = createSession(def, level, 0);
  for (const text of actions) s.apply(text);
  return s.toReplay();
}
