// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSession, type GameDef, type Replay } from '@kit/core';
import { mountGame } from './index';
import type { GameTexts, InputMap, ProofFile, ProofSet } from './index';
import { neutralTheme } from './test-theme';
import { createWatch, parseWatchParam, prepareProof, WATCH_MARK_MS, WATCH_STEP_MS, WATCH_RESTART_MS } from './watch';

// A turn game and a tick game with neutral names.
type TurnState = { total: number };
const turnGame: GameDef<TurnState, string> = {
  id: 'fake-turn',
  title: 'Fake turn',
  rulesVersion: '1',
  kind: 'turn',
  levels: () => [{ id: 'lv-1', title: 'One' }, { id: 'lv-2', title: 'Two' }],
  init: () => ({ total: 0 }),
  actions: (s) => (s.total >= 3 ? [] : ['add1', 'add2']),
  step: (s, a) => ({ total: s.total + (a === 'add1' ? 1 : 2) }),
  status: (s) => (s.total >= 3 ? { phase: 'won', score: s.total } : { phase: 'playing', score: s.total }),
  observe: (s) => ({ summary: `total ${s.total}`, facts: {} }),
  view: (_s, v) => ({ width: v.width, height: v.height, items: [{ kind: 'rect', id: 'item-1', layer: 'world', x: 0, y: 0, w: 40, h: 40, fill: '#336699' }] }),
  encodeAction: (a) => a,
  decodeAction: (t) => (t === 'add1' || t === 'add2' ? t : null),
};
const turnInput: InputMap<TurnState> = {
  idle: null,
  toAction: () => null,
  buttons: [{ id: 'btn-1', label: 'Add', action: 'add2' }],
  anchorFor: (a) => (a === 'add1' ? 'item-1' : a === 'add2' ? 'btn-1' : null),
  lessons: [],
};

type TickState = { n: number };
const tickGame: GameDef<TickState, string> = {
  id: 'fake-tick',
  title: 'Fake tick',
  rulesVersion: '1',
  kind: 'tick',
  ticksPerSecond: 60,
  levels: () => [{ id: 'lv-1', title: 'One' }],
  init: () => ({ n: 0 }),
  actions: (s) => (s.n >= 30 ? [] : ['none', 'hop']),
  step: (s) => ({ n: s.n + 1 }),
  status: (s) => (s.n >= 30 ? { phase: 'won', score: 0 } : { phase: 'playing', score: 0 }),
  observe: (s) => ({ summary: `n ${s.n}`, facts: {} }),
  view: (_s, v) => ({ width: v.width, height: v.height, items: [] }),
  encodeAction: (a) => a,
  decodeAction: (t) => (t === 'none' || t === 'hop' ? t : null),
};
const tickInput: InputMap<TickState> = { idle: 'none', toAction: () => null, buttons: [], anchorFor: (a) => (a === 'hop' ? 'player-1' : null), lessons: [] };

function proofFor<S extends import('@kit/core').Json>(def: GameDef<S, string>, level: string, runLengthActions: string[], flat: string[], checks = [{ name: 'size_ok', passed: true, detail: 'fine' }]): ProofFile {
  const session = createSession(def, level, 1);
  for (const a of flat) session.apply(a);
  const replay: Replay = {
    format: 1,
    game: def.id,
    rulesVersion: def.rulesVersion,
    level,
    seed: 1,
    actions: runLengthActions,
    finalHash: session.hash(),
    finalPhase: session.status().phase,
  };
  return { format: 1, game: def.id, kind: def.kind, level, rulesVersion: def.rulesVersion, seed: 1, checks, replay, stats: { actions: flat.length, nodes: 5 } };
}

const turnProof = () => proofFor(turnGame, 'lv-1', ['add1', 'add2'], ['add1', 'add2']);
const tickFlat = [...Array(10).fill('none'), 'hop', ...Array(19).fill('none')] as string[];
const tickProof = () => proofFor(tickGame, 'lv-1', ['none*10', 'hop', 'none*19'], tickFlat);
const turnTexts: GameTexts<TurnState> = { reasons: {} };
const tickTexts: GameTexts<TickState> = { reasons: {}, fairTicks: (id) => (id === 'lv-1' ? 7 : null) };

describe('prepareProof', () => {
  it('accepts a good turn proof and gives the proved text with the action count', () => {
    const prepared = prepareProof(turnGame, turnTexts, turnProof());
    expect(prepared.verdict).toEqual({ kind: 'proved', text: 'Proved in 2 actions' });
    expect(prepared.actions).toEqual(['add1', 'add2']);
  });

  it('accepts a good tick proof and gives the proved text with the fair ticks', () => {
    const prepared = prepareProof(tickGame, tickTexts, tickProof());
    expect(prepared.verdict).toEqual({ kind: 'proved', text: 'Proved: every jump has 7 ticks or more' });
    expect(prepared.actions.length).toBe(30);
  });

  it('shows this proof is out of date for a changed action and no proved text', () => {
    const proof = turnProof();
    proof.replay.actions = ['add2', 'add2'];
    const prepared = prepareProof(turnGame, turnTexts, proof);
    expect(prepared.verdict).toEqual({ kind: 'stale', text: 'This proof is out of date' });
  });

  it('shows out of date when the rules version changed', () => {
    const proof = turnProof();
    proof.replay.rulesVersion = '0';
    expect(prepareProof(turnGame, turnTexts, proof).verdict.kind).toBe('stale');
  });

  it('shows out of date when the replay does not end in won', () => {
    const proof = proofFor(turnGame, 'lv-1', ['add1'], ['add1']);
    expect(prepareProof(turnGame, turnTexts, proof).verdict.kind).toBe('stale');
  });

  it('hides the proved text when a check failed, and plays on', () => {
    const proof = proofFor(turnGame, 'lv-1', ['add1', 'add2'], ['add1', 'add2'], [{ name: 'size_ok', passed: false, detail: 'bad' }]);
    const prepared = prepareProof(turnGame, turnTexts, proof);
    expect(prepared.verdict).toEqual({ kind: 'unproved' });
    expect(prepared.actions).toEqual(['add1', 'add2']);
  });

  it('hides the proved text of a tick level that has no fair ticks', () => {
    const prepared = prepareProof(tickGame, { reasons: {}, fairTicks: () => null }, tickProof());
    expect(prepared.verdict).toEqual({ kind: 'unproved' });
  });
});

describe('createWatch on a turn level', () => {
  const make = () => createWatch({ def: turnGame, input: turnInput, texts: turnTexts, proof: turnProof() });

  it('plays the proof to won', () => {
    const watch = make();
    for (let i = 0; i < 2; i++) watch.frame(WATCH_STEP_MS);
    expect(watch.session.status().phase).toBe('won');
    expect(watch.finished()).toBe(true);
  });

  it('shows the pointer mark on the anchor before each action and clears it after', () => {
    const watch = make();
    expect(watch.mark()).toEqual({ action: 'add1', anchor: 'item-1' });
    watch.frame(WATCH_MARK_MS);
    expect(watch.session.tick).toBe(1);
    expect(watch.mark()).toBeNull();
    watch.frame(WATCH_STEP_MS - WATCH_MARK_MS);
    expect(watch.mark()).toEqual({ action: 'add2', anchor: 'btn-1' });
    watch.frame(WATCH_MARK_MS);
    expect(watch.session.tick).toBe(2);
  });

  it('runs 4 times faster at speed 4', () => {
    const watch = make();
    watch.setSpeed(4);
    expect(watch.speed()).toBe(4);
    watch.frame(WATCH_MARK_MS / 4);
    expect(watch.session.tick).toBe(1);
  });

  it('starts again 3 seconds after the end', () => {
    const watch = make();
    for (let i = 0; i < 2; i++) watch.frame(WATCH_STEP_MS);
    expect(watch.finished()).toBe(true);
    watch.frame(WATCH_RESTART_MS - 1);
    expect(watch.finished()).toBe(true);
    expect(watch.restarts()).toBe(0);
    watch.frame(1);
    expect(watch.restarts()).toBe(1);
    expect(watch.finished()).toBe(false);
    expect(watch.session.tick).toBe(0);
  });

  it('does not run a stale proof and never restarts it', () => {
    const proof = turnProof();
    proof.replay.actions = ['add2', 'add2'];
    const watch = createWatch({ def: turnGame, input: turnInput, texts: turnTexts, proof });
    expect(watch.verdict.kind).toBe('stale');
    expect(watch.finished()).toBe(true);
    watch.frame(10000);
    expect(watch.restarts()).toBe(0);
    expect(watch.session.tick).toBe(0);
  });
});

describe('createWatch on a tick level', () => {
  it('applies one action for each tick and wins after 30 ticks', () => {
    const watch = createWatch({ def: tickGame, input: tickInput, texts: tickTexts, proof: tickProof() });
    for (let i = 0; i < 40; i++) watch.frame(16);
    expect(watch.session.status().phase).toBe('won');
    expect(watch.session.tick).toBe(30);
  });

  it('shows the mark for an action that has an anchor and none for the idle action', () => {
    const watch = createWatch({ def: tickGame, input: tickInput, texts: tickTexts, proof: tickProof() });
    expect(watch.mark()).toBeNull();
    let sawMark = false;
    for (let i = 0; i < 40; i++) {
      watch.frame(16);
      const m = watch.mark();
      if (m) {
        sawMark = true;
        expect(m).toEqual({ action: 'hop', anchor: 'player-1' });
      }
    }
    expect(sawMark).toBe(true);
  });
});

describe('parseWatchParam', () => {
  const levels = [{ id: 'lv-1', title: 'One' }, { id: 'lv-2', title: 'Two' }];
  it('returns the level of ?watch=<levelId>', () => {
    expect(parseWatchParam('?watch=lv-2', levels)).toBe('lv-2');
    expect(parseWatchParam('?a=1&watch=lv-1', levels)).toBe('lv-1');
  });
  it('ignores a level id that is not a level of the game', () => {
    expect(parseWatchParam('?watch=zzz', levels)).toBeNull();
    expect(parseWatchParam('?watch=', levels)).toBeNull();
    expect(parseWatchParam('', levels)).toBeNull();
    expect(parseWatchParam('?other=lv-1', levels)).toBeNull();
  });
});

describe('mountGame with ?watch=', () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
  const proofs: ProofSet = {
    loadIndex: () => Promise.resolve({ game: 'fake-turn', levels: [{ id: 'lv-1', actions: 2 }] }),
    load: (id) => (id === 'lv-1' ? Promise.resolve(turnProof()) : Promise.reject(new Error('none'))),
  };
  const opts = (search: string) => ({ def: turnGame, theme: neutralTheme(), input: turnInput, proofs, texts: turnTexts, credits: [], search });

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    localStorage.clear();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('starts the watch screen at once with no tap and shows the proved text', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, opts('?watch=lv-1'));
    await settle();
    expect(root.querySelector<HTMLElement>('[data-screen]')?.dataset.screen).toBe('watch');
    expect(root.querySelector('[data-proof]')?.textContent).toBe('Proved in 2 actions');
    handle.destroy();
  });

  it('ignores a level id that is not a level of the game', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, opts('?watch=zzz'));
    await settle();
    expect(root.querySelector<HTMLElement>('[data-screen]')?.dataset.screen).toBe('title');
    handle.destroy();
  });

  it('goes to the title when the proof file does not load', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, opts('?watch=lv-2'));
    await settle();
    expect(root.querySelector<HTMLElement>('[data-screen]')?.dataset.screen).toBe('title');
    handle.destroy();
  });

  it('has a speed button for 1 times and 4 times and a back button', async () => {
    const root = document.getElementById('root')!;
    const handle = mountGame(root, opts('?watch=lv-1'));
    await settle();
    const ids = Array.from(root.querySelectorAll<HTMLElement>('[data-control]')).map((b) => b.dataset.control);
    expect(ids).toEqual(expect.arrayContaining(['speed-1', 'speed-4', 'back']));
    handle.destroy();
  });
});
