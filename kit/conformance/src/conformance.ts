import { createSession, hashState, runReplay, validateScene } from '@kit/core';
import type { GameDef, Json, Replay, Session } from '@kit/core';
import * as fc from 'fast-check';

export interface ConformanceOptions {
  runs?: number;
  maxActions?: number;
  seed?: number;
}

export interface PropertyResult {
  name: string;
  passed: boolean;
  counterexample?: Replay;
  message?: string;
}

const MAX_SEED = 2147483647;
const DEFAULT_RUNS = 100;
const DEFAULT_FAST_CHECK_SEED = 1;
const JUNK_TEXT = 'zz-not-an-action';
const VIEWPORTS = [
  { width: 320, height: 240, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { width: 400, height: 300, safe: { top: 12, right: 8, bottom: 16, left: 8 } },
];

type Def = GameDef<Json, unknown>;
type Run = { level: string; seed: number; picks: number[]; trail: string[] };
/** Returns null when the property holds, or one line that says why it does not. */
type Check = (def: Def, run: Run) => string | null;

/** Plays one run. `before` sees each state before the pick is applied. A text is pushed to the trail only when `apply` accepted it. */
function play(
  def: Def,
  run: Run,
  hooks: { before?: (s: Session<Json, unknown>, legal: string[]) => string | null; after?: (s: Session<Json, unknown>, text: string, hashBefore: string) => string | null } = {},
): string | null {
  const s = createSession(def, run.level, run.seed);
  for (let i = 0; ; i++) {
    const legal = s.legal();
    const early = hooks.before?.(s, legal) ?? null;
    if (early !== null) return early;
    if (legal.length === 0 || i >= run.picks.length) return null;
    const text = legal[(run.picks[i] as number) % legal.length] as string;
    const hashBefore = s.hash();
    const result = s.apply(text);
    if (!result.ok) return `apply refused the legal text "${text}" (${result.error}) at action ${i}`;
    run.trail.push(text);
    const late = hooks.after?.(s, text, hashBefore) ?? null;
    if (late !== null) return late;
  }
}

const repeatable: Check = (def, run) => {
  const a = createSession(def, run.level, run.seed);
  const b = createSession(def, run.level, run.seed);
  if (a.hash() !== b.hash()) return 'two fresh sessions start with different hashes';
  for (let i = 0; i < run.picks.length; i++) {
    const legalA = a.legal();
    const legalB = b.legal();
    if (legalA.join('\n') !== legalB.join('\n')) return `the legal actions differ before action ${i}`;
    if (legalA.length === 0) return null;
    const text = legalA[(run.picks[i] as number) % legalA.length] as string;
    const ra = a.apply(text);
    const rb = b.apply(text);
    if (!ra.ok || !rb.ok) return `apply refused the legal text "${text}" at action ${i}`;
    run.trail.push(text);
    if (ra.hash !== rb.hash) return `the hashes differ after action ${i} ("${text}")`;
  }
  return null;
};

const replayRoundTrip: Check = (def, run) => {
  let end: Session<Json, unknown> | null = null;
  const problem = play(def, run, { after: (s) => ((end = s), null) });
  if (problem !== null) return problem;
  const s = end ?? createSession(def, run.level, run.seed);
  const replay = s.toReplay();
  const result = runReplay(def, replay);
  if (!result.ok) return `runReplay failed with ${result.error}: ${result.message}`;
  if (result.finalHash !== s.hash()) return 'runReplay ends in another hash';
  if (result.finalPhase !== s.status().phase) return 'runReplay ends in another phase';
  return null;
};

const legalClosure: Check = (def, run) => {
  const seen = new Set<string>();
  return play(def, run, {
    before(s, legal) {
      const h0 = s.hash();
      const tick = s.tick;
      for (const text of legal) {
        if (def.decodeAction(text) === null) return `the legal text "${text}" does not decode`;
        seen.add(text);
      }
      const outside = [JUNK_TEXT, ...[...seen].filter((text) => !legal.includes(text))];
      for (const text of outside) {
        const result = s.apply(text);
        if (result.ok) return `apply accepted "${text}", which is not in legal()`;
        if (s.hash() !== h0 || s.tick !== tick) return `a refused apply of "${text}" changed the session`;
        const action = def.decodeAction(text);
        if (action !== null && !legal.includes(text)) {
          const next = def.step(s.state, action);
          if (hashState(next) !== h0) return `step accepted "${text}", which is not in actions(state), and changed the state`;
        }
      }
      return null;
    },
  });
};

const plainData: Check = (def, run) => {
  const test = (s: Session<Json, unknown>, where: string): string | null => {
    let h: string;
    try {
      h = hashState(s.state);
    } catch (error) {
      return `${where}: the state is not plain data (${error instanceof Error ? error.message : String(error)})`;
    }
    if (hashState(JSON.parse(JSON.stringify(s.state)) as Json) !== h) return `${where}: the state changes when written as JSON and read back`;
    return null;
  };
  return play(def, run, {
    before: (s) => (s.tick === 0 ? test(s, 'at the start') : null),
    after: (s, text) => test(s, `after "${text}"`),
  });
};

const inputNotChanged: Check = (def, run) =>
  play(def, run, {
    before(s, legal) {
      for (const text of legal) {
        const action = def.decodeAction(text);
        if (action === null) return `the legal text "${text}" does not decode`;
        const h0 = hashState(s.state);
        def.step(s.state, action);
        if (hashState(s.state) !== h0) return `step changed its input state for "${text}"`;
      }
      return null;
    },
  });

const gameOverIsFinal: Check = (def, run) =>
  play(def, run, {
    before(s, legal) {
      if (s.status().phase === 'playing') return null;
      if (legal.length !== 0) return 'legal() is not empty after the game ended';
      const h0 = s.hash();
      const tick = s.tick;
      for (const text of [JUNK_TEXT, '', ...run.trail]) {
        const result = s.apply(text);
        if (result.ok || result.error !== 'game_over') return `apply of "${text}" after the end did not return game_over`;
        if (s.hash() !== h0 || s.tick !== tick) return `apply of "${text}" after the end changed the session`;
      }
      return null;
    },
  });

const actionTextRoundTrip: Check = (def, run) =>
  play(def, run, {
    before(s) {
      for (const action of def.actions(s.state)) {
        const text = def.encodeAction(action);
        if (text.includes('*')) return `the action text "${text}" holds "*"`;
        const back = def.decodeAction(text);
        if (back === null) return `the action text "${text}" does not decode`;
        if (def.encodeAction(back) !== text) return `the action text "${text}" does not survive decode and encode`;
      }
      return null;
    },
  });

const undo: Check = (def, run) => {
  if (def.kind !== 'turn') return null;
  return play(def, run, {
    after(s, text, hashBefore) {
      const tick = s.tick;
      if (!s.undo()) return `undo returned false after "${text}"`;
      if (s.hash() !== hashBefore) return `undo did not restore the hash after "${text}"`;
      if (s.tick !== tick - 1) return `undo did not lower the tick after "${text}"`;
      const again = s.apply(text);
      if (!again.ok) return `"${text}" was refused after undo`;
      return null;
    },
  });
};

const viewAndObservationSafe: Check = (def, run) => {
  const test = (s: Session<Json, unknown>, where: string): string | null => {
    for (const viewport of VIEWPORTS) {
      const problems = validateScene(def.view(s.state, viewport));
      if (problems.length > 0) return `${where}: view gives a bad scene (${problems[0]})`;
    }
    const obs = def.observe(s.state);
    if (obs.summary.length > 120) return `${where}: the summary has ${obs.summary.length} characters`;
    const rows = obs.textMap;
    if (rows !== undefined && rows.some((row) => row.length !== (rows[0] as string).length)) return `${where}: the rows of textMap differ in length`;
    return null;
  };
  return play(def, run, {
    before: (s) => (s.tick === 0 ? test(s, 'at the start') : null),
    after: (s, text) => test(s, `after "${text}"`),
  });
};

const PROPERTIES: [string, Check][] = [
  ['repeatable', repeatable],
  ['replay-round-trip', replayRoundTrip],
  ['legal-closure', legalClosure],
  ['plain-data', plainData],
  ['input-not-changed', inputNotChanged],
  ['game-over-is-final', gameOverIsFinal],
  ['action-text-round-trip', actionTextRoundTrip],
  ['undo', undo],
  ['view-and-observation-safe', viewAndObservationSafe],
];

function attempt(check: Check, def: Def, run: Run): string | null {
  run.trail.length = 0;
  try {
    return check(def, run);
  } catch (error) {
    return `threw ${error instanceof Error ? error.message : String(error)}`;
  }
}

function toCounterexample(def: Def, run: Run): Replay {
  const s = createSession(def, run.level, run.seed);
  for (const text of run.trail) s.apply(text);
  return s.toReplay();
}

/** Runs the nine conformance properties on a game definition and returns one result for each. */
export function runConformance<S extends Json, A>(def: GameDef<S, A>, options: ConformanceOptions = {}): PropertyResult[] {
  const anyDef = def as unknown as Def;
  const runs = options.runs ?? DEFAULT_RUNS;
  const maxActions = options.maxActions ?? (def.kind === 'turn' ? 60 : 600);
  const seed = options.seed ?? DEFAULT_FAST_CHECK_SEED;
  const levelIds = def.levels().map((level) => level.id);

  return PROPERTIES.map(([name, check]): PropertyResult => {
    const arbitrary = fc.tuple(fc.constantFrom(...levelIds), fc.integer({ min: 0, max: MAX_SEED }), fc.array(fc.nat(1000), { maxLength: maxActions }));
    const details = fc.check(
      fc.property(arbitrary, ([level, gameSeed, picks]) => attempt(check, anyDef, { level, seed: gameSeed, picks, trail: [] }) === null),
      { numRuns: runs, seed },
    );
    if (!details.failed) return { name, passed: true };
    const [level, gameSeed, picks] = details.counterexample?.[0] ?? [levelIds[0] as string, 0, []];
    const run: Run = { level, seed: gameSeed, picks, trail: [] };
    const why = attempt(check, anyDef, run) ?? 'the property failed';
    try {
      return { name, passed: false, counterexample: toCounterexample(anyDef, run), message: `${name}: ${why} (level ${level}, seed ${gameSeed})` };
    } catch (error) {
      return { name, passed: false, message: `${name}: ${why} (level ${level}, seed ${gameSeed}; no replay: ${error instanceof Error ? error.message : String(error)})` };
    }
  });
}
