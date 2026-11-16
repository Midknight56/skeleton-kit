import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createSession, runReplay, type GameDef, type Json, type Replay } from '@kit/core';
import sampleLights from '../test-fixtures/sample-lights/def';
import sampleHop from '../test-fixtures/sample-hop/def';
import { errorCode, makeContext, okText, okValue } from './test-helpers';
import { act, newGame, observe, render, replay } from './tools';

describe('new_game', () => {
  it('lists the game and its levels when no level is given, and creates no session', () => {
    const ctx = makeContext(sampleLights);
    const value = okValue(newGame(ctx, {}));
    expect(value).toEqual({
      game: 'sample-lights',
      kind: 'turn',
      levels: [
        { id: 'l1', title: 'One press' },
        { id: 'l2', title: 'Two presses' },
        { id: 'l3', title: 'Three presses' },
      ],
    });
    expect(ctx.store.size()).toBe(0);
  });

  it('starts a session on a known level with seed 1 by default', () => {
    const ctx = makeContext(sampleLights);
    const value = okValue(newGame(ctx, { level: 'l1' }));
    expect(value.session).toBe('s1');
    expect(value.level).toBe('l1');
    expect(value.seed).toBe(1);
    expect(value.tick).toBe(0);
    expect(value.status).toEqual({ phase: 'playing', score: 0 });
    expect((value.observation as { facts: unknown }).facts).toEqual({ lampsOn: 5, moves: 0 });
    expect(value.legal).toHaveLength(9);
    expect((value.legal as string[])[0]).toBe('press:0,0');
    expect(ctx.store.size()).toBe(1);
  });

  it('keeps a given seed', () => {
    const ctx = makeContext(sampleLights);
    expect(okValue(newGame(ctx, { level: 'l2', seed: 7 })).seed).toBe(7);
    expect(okValue(newGame(ctx, { level: 'l2', seed: 0 })).seed).toBe(0);
    expect(okValue(newGame(ctx, { level: 'l2', seed: 2147483647 })).seed).toBe(2147483647);
  });

  it('returns unknown_level for a level the game does not have', () => {
    const ctx = makeContext(sampleLights);
    expect(errorCode(newGame(ctx, { level: 'zz' }))).toBe('unknown_level');
    expect(ctx.store.size()).toBe(0);
  });

  it('returns bad_seed for a seed of -1, 1.5 or 2147483648', () => {
    const ctx = makeContext(sampleLights);
    expect(errorCode(newGame(ctx, { level: 'l1', seed: -1 }))).toBe('bad_seed');
    expect(errorCode(newGame(ctx, { level: 'l1', seed: 1.5 }))).toBe('bad_seed');
    expect(errorCode(newGame(ctx, { level: 'l1', seed: 2147483648 }))).toBe('bad_seed');
    expect(ctx.store.size()).toBe(0);
  });

  it('returns bad_input for a field of the wrong type', () => {
    const ctx = makeContext(sampleLights);
    expect(errorCode(newGame(ctx, { level: 5 }))).toBe('bad_input');
    expect(errorCode(newGame(ctx, { level: 'l1', seed: 'one' }))).toBe('bad_input');
    expect(errorCode(newGame(ctx, null))).toBe('bad_input');
    expect(ctx.store.size()).toBe(0);
  });

  it('works for a tick game', () => {
    const ctx = makeContext(sampleHop);
    const value = okValue(newGame(ctx, {}));
    expect(value.kind).toBe('tick');
    const started = okValue(newGame(ctx, { level: 'h1' }));
    expect(started.legal).toEqual(['none', 'hop']);
  });
});

describe('observe', () => {
  it('returns the state of a new session and changes nothing', () => {
    const ctx = makeContext(sampleLights);
    const started = okValue(newGame(ctx, { level: 'l1' }));
    const first = okValue(observe(ctx, { session: 's1' }));
    const second = okValue(observe(ctx, { session: 's1' }));
    expect(first).toEqual(second);
    expect(first.tick).toBe(0);
    expect(first.status).toEqual({ phase: 'playing', score: 0 });
    expect(first.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(first.observation).toEqual(started.observation);
    expect(first.legal).toEqual(started.legal);
  });

  it('returns unknown_session for an id that was never issued', () => {
    const ctx = makeContext(sampleLights);
    expect(errorCode(observe(ctx, { session: 's1' }))).toBe('unknown_session');
  });

  it('returns bad_input for a missing or wrong session field', () => {
    const ctx = makeContext(sampleLights);
    expect(errorCode(observe(ctx, {}))).toBe('bad_input');
    expect(errorCode(observe(ctx, { session: 1 }))).toBe('bad_input');
  });

  it('counts as a use of the session', () => {
    const ctx = makeContext(sampleLights);
    for (let i = 0; i < 8; i++) newGame(ctx, { level: 'l1' });
    observe(ctx, { session: 's1' });
    newGame(ctx, { level: 'l1' });
    expect(errorCode(observe(ctx, { session: 's2' }))).toBe('unknown_session');
    expect(okValue(observe(ctx, { session: 's1' })).tick).toBe(0);
  });
});

function start(def: unknown, level: string) {
  const ctx = makeContext(def);
  const session = okValue(newGame(ctx, { level })).session as string;
  return { ctx, session };
}

describe('act', () => {
  it('applies a run of none on the hop game', () => {
    const { ctx, session } = start(sampleHop, 'h1');
    const value = okValue(act(ctx, { session, actions: ['none*5'] }));
    expect(value.applied).toBe(5);
    expect(value.stoppedBy).toBeNull();
    expect(value.tick).toBe(5);
    expect((value.status as { phase: string }).phase).toBe('playing');
    expect(value.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('stops at game_over after the level is won', () => {
    const { ctx, session } = start(sampleLights, 'l1');
    const value = okValue(act(ctx, { session, actions: ['press:1,1', 'press:0,0'] }));
    expect(value.applied).toBe(1);
    expect(value.stoppedBy).toBe('game_over');
    expect((value.status as { phase: string }).phase).toBe('won');
  });

  it('stops at bad_action_text when an item is not an action', () => {
    const { ctx, session } = start(sampleLights, 'l1');
    const value = okValue(act(ctx, { session, actions: ['press:0,0', 'press:9,9', 'press:1,1'] }));
    expect(value.applied).toBe(1);
    expect(value.stoppedBy).toBe('bad_action_text');
    expect(value.tick).toBe(1);
  });

  it('stops at illegal_action when the text decodes but is not in the legal list', () => {
    const onlyNone = {
      ...(sampleHop as object),
      actions: (state: { lost: boolean; cell: number }) => (state.lost || state.cell >= 39 ? [] : ['none']),
    };
    const { ctx, session } = start(onlyNone, 'h1');
    const value = okValue(act(ctx, { session, actions: ['none', 'hop', 'none'] }));
    expect(value.applied).toBe(1);
    expect(value.stoppedBy).toBe('illegal_action');
    expect(value.tick).toBe(1);
  });

  it('rejects more than 600 items', () => {
    const { ctx, session } = start(sampleHop, 'h1');
    const value = act(ctx, { session, actions: Array.from({ length: 601 }, () => 'none') });
    expect(errorCode(value)).toBe('too_many_actions');
    expect(okValue(act(ctx, { session, actions: ['none'] })).tick).toBe(1);
  });

  it('rejects more than 3600 actions after expansion and applies nothing', () => {
    const { ctx, session } = start(sampleHop, 'h1');
    const value = act(ctx, { session, actions: ['none*3600', 'none'] });
    expect(errorCode(value)).toBe('too_many_actions');
    const observed = okValue(act(ctx, { session, actions: ['none'] }));
    expect(observed.tick).toBe(1);
  });

  it('rejects an empty list with bad_input', () => {
    const { ctx, session } = start(sampleHop, 'h1');
    expect(errorCode(act(ctx, { session, actions: [] }))).toBe('bad_input');
  });

  it('treats a malformed star form as one action that stops the run', () => {
    const { ctx, session } = start(sampleHop, 'h1');
    const value = okValue(act(ctx, { session, actions: ['none', 'none*1', 'none'] }));
    expect(value.applied).toBe(1);
    expect(value.stoppedBy).toBe('bad_action_text');
    expect(value.tick).toBe(1);
  });

  it('returns unknown_session for a bad id', () => {
    const ctx = makeContext(sampleHop);
    expect(errorCode(act(ctx, { session: 's1', actions: ['none'] }))).toBe('unknown_session');
  });

  it('returns bad_input for a missing or wrong field', () => {
    const { ctx, session } = start(sampleHop, 'h1');
    expect(errorCode(act(ctx, { session }))).toBe('bad_input');
    expect(errorCode(act(ctx, { session, actions: 'none' }))).toBe('bad_input');
    expect(errorCode(act(ctx, { session, actions: [1, 2] }))).toBe('bad_input');
  });
});

function hashAfter(def: GameDef<Json, unknown>, level: string, seed: number, actions: string[]): string {
  const session = createSession(def, level, seed);
  for (const text of actions) session.apply(text);
  return session.hash();
}

describe('render', () => {
  it('returns SVG text for a 960 by 540 viewport on both samples', () => {
    for (const [def, level, id] of [[sampleLights, 'l1', 'lamp-'], [sampleHop, 'h1', 'block-']] as const) {
      const { ctx, session } = start(def, level);
      const svg = okText(render(ctx, { session, format: 'svg' }));
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('width="960"');
      expect(svg).toContain('height="540"');
      expect(svg).toContain(`data-id="${id}`);
      expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    }
  });

  it('returns the summary, the text map and the legend as text', () => {
    const { ctx, session } = start(sampleLights, 'l1');
    expect(okText(render(ctx, { session, format: 'text' }))).toBe(
      [
        '5 lamps are on. A press flips a lamp and its neighbours.',
        '',
        '.#.',
        '###',
        '.#.',
        '',
        '# = lamp on',
        '. = lamp off',
      ].join('\n'),
    );
  });

  it('returns the text view of the tick sample', () => {
    const { ctx, session } = start(sampleHop, 'h1');
    const text = okText(render(ctx, { session, format: 'text' }));
    const lines = text.split('\n');
    expect(lines[0]).toBe('The runner is on cell 0 of 39.');
    expect(lines[2]).toBe(`@${'.'.repeat(9)}#${'.'.repeat(28)}G`);
  });

  it('returns only the summary when a game gives no text map', () => {
    const plain = {
      ...(sampleLights as object),
      observe: () => ({ summary: 'Only a summary.', facts: {} }),
    };
    const { ctx, session } = start(plain, 'l1');
    expect(okText(render(ctx, { session, format: 'text' }))).toBe('Only a summary.');
  });

  it('returns unknown_session, and bad_input for a bad format', () => {
    const ctx = makeContext(sampleLights);
    expect(errorCode(render(ctx, { session: 's1', format: 'svg' }))).toBe('unknown_session');
    const { ctx: ctx2, session } = start(sampleLights, 'l1');
    expect(errorCode(render(ctx2, { session, format: 'png' }))).toBe('bad_input');
    expect(errorCode(render(ctx2, { session }))).toBe('bad_input');
    expect(errorCode(render(ctx2, { format: 'svg' }))).toBe('bad_input');
  });
});

describe('replay', () => {
  const temporary: string[] = [];
  afterAll(() => {
    for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
  });

  function copyOfFixture(): string {
    const dir = mkdtempSync(join(tmpdir(), 'kit-mcp-'));
    temporary.push(dir);
    const target = join(dir, 'sample-lights');
    // Skip tests/, which holds the replay saved in the playtester run, so that each copy starts with no saved files.
    cpSync(new URL('../test-fixtures/sample-lights', import.meta.url), target, {
      recursive: true,
      filter: (source) => !/[\\/]tests([\\/]|$)/.test(source),
    });
    return target;
  }

  function played(appDir: string) {
    const ctx = makeContext(sampleLights, appDir);
    const session = okValue(newGame(ctx, { level: 'l2' })).session as string;
    okValue(act(ctx, { session, actions: ['press:0,0', 'press:2,2'] }));
    return { ctx, session };
  }

  it('returns the replay of a session', () => {
    const { ctx, session } = played('.');
    const value = okValue(replay(ctx, { session }));
    const given = value.replay as Replay;
    expect(given).toMatchObject({
      format: 1,
      game: 'sample-lights',
      rulesVersion: '1',
      level: 'l2',
      seed: 1,
      actions: ['press:0,0', 'press:2,2'],
      finalPhase: 'won',
    });
    expect(given.finalHash).toMatch(/^[0-9a-f]{16}$/);
    expect(value.file).toBeUndefined();
    expect(runReplay(sampleLights as unknown as GameDef<Json, unknown>, given).ok).toBe(true);
  });

  it('writes nothing when save is missing or false', () => {
    const appDir = copyOfFixture();
    const { ctx, session } = played(appDir);
    replay(ctx, { session });
    replay(ctx, { session, save: false });
    expect(existsSync(join(appDir, 'tests'))).toBe(false);
  });

  it('saves the replay under tests/replays of the game folder', () => {
    const appDir = copyOfFixture();
    const { ctx, session } = played(appDir);
    const value = okValue(replay(ctx, { session, save: true }));
    const given = value.replay as Replay;
    const file = value.file as string;
    expect(file).toBe(join(appDir, 'tests', 'replays', `sample-lights-l2-${given.finalHash}.json`));
    const text = readFileSync(file, 'utf8');
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).not.toContain('\r');
    expect(JSON.parse(text)).toEqual(given);
  });

  it('checks a good replay', () => {
    const { ctx, session } = played('.');
    const given = okValue(replay(ctx, { session })).replay as Replay;
    const fresh = makeContext(sampleLights);
    const value = okValue(replay(fresh, { replay: given }));
    expect(value).toEqual({ ok: true, finalHash: given.finalHash, finalPhase: 'won' });
  });

  it('reports a changed replay', () => {
    const { ctx, session } = played('.');
    const given = okValue(replay(ctx, { session })).replay as Replay;
    const changed = okValue(replay(ctx, { replay: { ...given, finalHash: '0000000000000000' } }));
    expect(changed.ok).toBe(false);
    expect(changed.error).toBe('hash_mismatch');
    const wrongGame = okValue(replay(ctx, { replay: { ...given, game: 'other' } }));
    expect(wrongGame.error).toBe('wrong_game');
  });

  it('returns unknown_session for an id that does not exist', () => {
    const ctx = makeContext(sampleLights);
    expect(errorCode(replay(ctx, { session: 's1' }))).toBe('unknown_session');
  });

  it('returns bad_input for both a session and a replay, for neither, and for wrong types', () => {
    const { ctx, session } = played('.');
    const given = okValue(replay(ctx, { session })).replay;
    expect(errorCode(replay(ctx, { session, replay: given }))).toBe('bad_input');
    expect(errorCode(replay(ctx, {}))).toBe('bad_input');
    expect(errorCode(replay(ctx, { replay: 'text' }))).toBe('bad_input');
    expect(errorCode(replay(ctx, { replay: null }))).toBe('bad_input');
    expect(errorCode(replay(ctx, { session, save: 'yes' }))).toBe('bad_input');
  });
});

describe('observe changes nothing', () => {
  it('leaves the hash unchanged after any mix of observe and render calls', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('l1', 'l2', 'l3'),
        fc.array(fc.constantFrom('observe', 'svg', 'text'), { maxLength: 12 }),
        (level, calls) => {
          const { ctx, session } = start(sampleLights, level);
          const before = okValue(observe(ctx, { session }));
          for (const call of calls) {
            if (call === 'observe') observe(ctx, { session });
            else render(ctx, { session, format: call });
          }
          const after = okValue(observe(ctx, { session }));
          expect(after).toEqual(before);
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe('tool door equals session', () => {
  it('act gives the same hash as a kit/core session for the applied prefix', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('none', 'hop'), { minLength: 1, maxLength: 60 }), (actions) => {
        const { ctx, session } = start(sampleHop, 'h1');
        const result = okValue(act(ctx, { session, actions }));
        const applied = result.applied as number;
        const reference = hashAfter(sampleHop, 'h1', 1, actions.slice(0, applied));
        expect(result.hash).toBe(reference);
      }),
      { numRuns: 100 },
    );
  });
});
