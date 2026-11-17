// Properties taken from the acceptance criteria of .kiro/specs/kit-core/requirements.md.
// Each one checks something that the nine properties in kit/conformance do not check.
// Numbers 10 to 21 continue the list in the Correctness Properties section of design.md.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { KitError } from './errors';
import { hashState } from './hash';
import { nextRandom, randomInt } from './random';
import { runReplay } from './replay';
import { compressActions, expandActions } from './rle';
import { paintSvg, validateScene } from './scene';
import { createSession } from './session';
import { hop, lights } from './test-fixtures';
import type { GameDef, Json, Layer, Replay, Scene, SceneItem } from './types';
import { validateDef } from './validate';

type AnyDef = GameDef<Json, unknown>;
const DEFS: AnyDef[] = [lights as unknown as AnyDef, hop as unknown as AnyDef];
const MAX_SEED = 2147483647;
const arbDef = fc.constantFrom(...DEFS);
const arbSeed = fc.integer({ min: 0, max: MAX_SEED });
const arbPicks = fc.array(fc.nat(1000), { maxLength: 40 });
const options = { numRuns: 100 };

function levelOf(def: AnyDef, n: number): string {
  const levels = def.levels();
  return (levels[n % levels.length] as { id: string }).id;
}

/** Applies the picked legal actions and returns the session. */
function play(def: AnyDef, level: string, seed: number, picks: number[]) {
  const session = createSession(def, level, seed);
  for (const pick of picks) {
    const legal = session.legal();
    if (legal.length === 0) break;
    session.apply(legal[pick % legal.length] as string);
  }
  return session;
}

describe('property 10: session start (2.1, 2.2)', () => {
  it('starts on def.init at tick 0 and throws the right KitError for a bad level or seed', () => {
    fc.assert(
      fc.property(arbDef, fc.nat(10), arbSeed, (def, n, seed) => {
        const level = levelOf(def, n);
        const s = createSession(def, level, seed);
        expect(s.hash()).toBe(hashState(def.init(level, seed)));
        expect(s.tick).toBe(0);
      }),
      options,
    );
    fc.assert(
      fc.property(
        arbDef,
        fc.oneof(fc.integer({ min: MAX_SEED + 1, max: MAX_SEED + 1000 }), fc.integer({ min: -1000, max: -1 }), fc.double({ noInteger: true, min: 0, max: 100 }), fc.constantFrom(NaN, Infinity, -Infinity)),
        (def, seed) => {
          expect(() => createSession(def, levelOf(def, 0), seed)).toThrowError(expect.objectContaining({ code: 'bad_seed' }) as Error);
        },
      ),
      options,
    );
    fc.assert(
      fc.property(arbDef, fc.string(), arbSeed, (def, level, seed) => {
        fc.pre(!def.levels().some((l) => l.id === level));
        try {
          createSession(def, level, seed);
          throw new Error('no throw');
        } catch (error) {
          expect(error).toBeInstanceOf(KitError);
          expect((error as KitError).code).toBe('unknown_level');
        }
      }),
      options,
    );
  });
});

describe('property 11: apply is step (2.3)', () => {
  it('replaces the state with def.step, adds 1 to the tick and reports its hash and status', () => {
    fc.assert(
      fc.property(arbDef, fc.nat(10), arbSeed, arbPicks, (def, n, seed, picks) => {
        const s = createSession(def, levelOf(def, n), seed);
        for (const pick of picks) {
          const legal = s.legal();
          if (legal.length === 0) break;
          const text = legal[pick % legal.length] as string;
          const expected = def.step(s.state, def.decodeAction(text));
          const tick = s.tick;
          const result = s.apply(text);
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          expect(hashState(s.state)).toBe(hashState(expected));
          expect(s.tick).toBe(tick + 1);
          expect(result.hash).toBe(hashState(expected));
          expect(result.status).toEqual(def.status(expected));
        }
      }),
      options,
    );
  });
});

describe('property 12: refused text keeps the session (2.4, 2.5)', () => {
  it('answers bad_action_text for text that does not decode, and illegal_action for a decoded action that is not listed', () => {
    // The wrapped lights game hides the press at 0,0 but still decodes it.
    const hidden: AnyDef = {
      ...(lights as unknown as AnyDef),
      actions: (state) => (lights.actions(state as never) as unknown[]).filter((a) => (a as { x: number; y: number }).x !== 0 || (a as { x: number; y: number }).y !== 0),
    };
    fc.assert(
      fc.property(fc.string(), arbSeed, arbPicks, (text, seed, picks) => {
        fc.pre(lights.decodeAction(text) === null && text !== 'press:0,0');
        const s = play(hidden, 'l2', seed, picks);
        fc.pre(s.status().phase === 'playing');
        const hash = s.hash();
        const tick = s.tick;
        const bad = s.apply(text);
        expect(bad.ok === false && bad.error).toBe('bad_action_text');
        const illegal = s.apply('press:0,0');
        expect(illegal.ok === false && illegal.error).toBe('illegal_action');
        expect(s.hash()).toBe(hash);
        expect(s.tick).toBe(tick);
      }),
      options,
    );
  });
});

describe('property 13: legal lists the actions in order (2.7)', () => {
  it('returns the encoded text of every def.actions(state) item in the same order', () => {
    fc.assert(
      fc.property(arbDef, fc.nat(10), arbSeed, arbPicks, (def, n, seed, picks) => {
        const s = play(def, levelOf(def, n), seed, picks);
        expect(s.legal()).toEqual(def.actions(s.state).map((a) => def.encodeAction(a)));
      }),
      options,
    );
  });
});

describe('property 14: undo limits (2.8)', () => {
  it('returns false and changes nothing on a tick game', () => {
    fc.assert(
      fc.property(fc.nat(10), arbSeed, arbPicks, (n, seed, picks) => {
        const s = play(hop as unknown as AnyDef, levelOf(hop as unknown as AnyDef, n), seed, picks);
        const hash = s.hash();
        const tick = s.tick;
        expect(s.undo()).toBe(false);
        expect(s.hash()).toBe(hash);
        expect(s.tick).toBe(tick);
      }),
      options,
    );
  });
  it('returns false on a fresh turn game, and keeps exactly the last 500 states', () => {
    const def = lights as unknown as AnyDef;
    const s = createSession(def, 'l2', 0);
    expect(s.undo()).toBe(false);
    for (let i = 0; i < 600; i++) expect(s.apply('press:0,0').ok).toBe(true);
    let undone = 0;
    while (s.undo()) undone++;
    expect(undone).toBe(500);
    expect(s.tick).toBe(100);
  });
});

function reorder(value: Json): Json {
  if (Array.isArray(value)) return value.map(reorder);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reorder(v)]));
  }
  return value;
}

describe('property 15: hash shape and key order (3.1, 3.2)', () => {
  it('is 16 lower case hex characters and does not depend on key order', () => {
    fc.assert(
      fc.property(fc.jsonValue() as fc.Arbitrary<Json>, (value) => {
        const h = hashState(value);
        expect(h).toMatch(/^[0-9a-f]{16}$/);
        expect(hashState(reorder(value))).toBe(h);
      }),
      options,
    );
  });
});

describe('property 16: not plain data names the path (3.3)', () => {
  const bad: [string, () => unknown][] = [
    ['undefined', () => undefined],
    ['function', () => () => 1],
    ['NaN', () => NaN],
    ['Infinity', () => Infinity],
    ['Map', () => new Map()],
    ['Set', () => new Set()],
    ['Date', () => new Date(0)],
  ];
  it('throws KitError not_plain_data with the path of the bad value', () => {
    fc.assert(
      fc.property(fc.constantFrom(...bad), fc.stringMatching(/^[a-z]{1,6}$/), fc.nat(5), (item, key, index) => {
        const list: unknown[] = new Array<unknown>(index).fill(0);
        list.push({ [key]: item[1]() });
        const state = { outer: list } as unknown as Json;
        const path = `$.outer[${index}].${key}`;
        try {
          hashState(state);
          throw new Error(`no throw for ${item[0]}`);
        } catch (error) {
          expect(error).toBeInstanceOf(KitError);
          expect((error as KitError).code).toBe('not_plain_data');
          expect((error as KitError).path).toBe(path);
          expect((error as KitError).message).toContain(path);
        }
      }),
      options,
    );
  });
});

describe('property 17: run length form (4.2)', () => {
  it('expand undoes compress, every count is from 2 to 3600, and a text with * is rejected', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('a', 'b', 'press:1,1'), { maxLength: 60 }), (actions) => {
        const items = compressActions(actions);
        const back = expandActions(items);
        expect(back.ok && back.actions).toEqual(actions);
        for (const item of items) {
          const count = item.split('*')[1];
          if (count !== undefined) expect(Number(count)).toBeGreaterThanOrEqual(2);
        }
      }),
      options,
    );
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12000 }), (n) => {
        const items = compressActions(new Array<string>(n).fill('a'));
        const counts = items.map((item) => Number(item.split('*')[1] ?? 1));
        expect(counts.reduce((a, b) => a + b, 0)).toBe(n);
        for (const c of counts) expect(c).toBeLessThanOrEqual(3600);
        for (const item of items) if (item.includes('*')) expect(Number(item.split('*')[1])).toBeGreaterThanOrEqual(2);
      }),
      options,
    );
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        expect(() => compressActions([`${a}*${b}`])).toThrowError(expect.objectContaining({ code: 'not_plain_data' }) as Error);
      }),
      options,
    );
  });
});

function recorded(def: AnyDef, n: number, seed: number, picks: number[]): { replay: Replay; ended: boolean } {
  const s = play(def, levelOf(def, n), seed, picks);
  return { replay: s.toReplay(), ended: s.status().phase !== 'playing' };
}

describe('property 18: replay failures (4.4 to 4.7)', () => {
  it('reports the zero based index of a bad action after expansion', () => {
    fc.assert(
      fc.property(arbDef, fc.nat(10), arbSeed, arbPicks, fc.constantFrom('zz-not-an-action', 'a*b', '*3'), (def, n, seed, picks, junk) => {
        const { replay, ended } = recorded(def, n, seed, picks);
        const length = expandActions(replay.actions);
        if (!length.ok) throw new Error('own replay does not expand');
        const result = runReplay(def, { ...replay, actions: [...replay.actions, junk] });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        if (junk !== 'zz-not-an-action') {
          // A malformed run length item is refused before any action runs.
          expect(result.error).toBe('bad_action_text');
        } else {
          // After the end every text gives game_over, even one that does not decode.
          expect(result.error).toBe(ended ? 'game_over' : 'bad_action_text');
          expect(result.mismatchAt).toBe(length.actions.length);
        }
      }),
      options,
    );
  });
  it('reports hash_mismatch and phase_mismatch', () => {
    fc.assert(
      fc.property(arbDef, fc.nat(10), arbSeed, arbPicks, (def, n, seed, picks) => {
        const { replay } = recorded(def, n, seed, picks);
        const hashed = runReplay(def, { ...replay, finalHash: replay.finalHash === '0'.repeat(16) ? '1'.repeat(16) : '0'.repeat(16) });
        expect(hashed.ok === false && hashed.error).toBe('hash_mismatch');
        const phase = replay.finalPhase === 'won' ? 'lost' : 'won';
        const phased = runReplay(def, { ...replay, finalPhase: phase });
        expect(phased.ok === false && phased.error).toBe('phase_mismatch');
      }),
      options,
    );
  });
  it('refuses another game, another rules version, an unknown level or a bad seed without running an action', () => {
    fc.assert(
      fc.property(arbDef, fc.nat(10), arbSeed, arbPicks, fc.string({ minLength: 1 }), (def, n, seed, picks, other) => {
        const { replay } = recorded(def, n, seed, picks);
        // The actions are junk, so an error that comes from running them would show.
        const base = { ...replay, actions: ['zz-not-an-action'] };
        expect(runReplay(def, { ...base, game: `${def.id}-${other}` })).toMatchObject({ ok: false, error: 'wrong_game' });
        expect(runReplay(def, { ...base, rulesVersion: `${def.rulesVersion}${other}` })).toMatchObject({ ok: false, error: 'rules_changed' });
        expect(runReplay(def, { ...base, level: `no-level-${other}` })).toMatchObject({ ok: false, error: 'unknown_level' });
        for (const bad of [-1, MAX_SEED + 1, 1.5, NaN, Infinity]) {
          expect(runReplay(def, { ...base, seed: bad })).toMatchObject({ ok: false, error: 'bad_seed' });
        }
      }),
      options,
    );
  });
  it('never throws on data from a file', () => {
    const junk = fc.anything({ withNullPrototype: true, withBigInt: true, withObjectString: true });
    fc.assert(
      fc.property(arbDef, junk, junk, junk, junk, junk, junk, junk, (def, game, rules, level, seed, actions, hash, phase) => {
        const replay = { format: 1, game, rulesVersion: rules, level, seed, actions, finalHash: hash, finalPhase: phase } as unknown as Replay;
        expect(() => runReplay(def, replay)).not.toThrow();
        const result = runReplay(def, replay);
        expect(typeof result.ok).toBe('boolean');
      }),
      options,
    );
    fc.assert(
      fc.property(arbDef, fc.nat(10), arbSeed, fc.array(fc.string(), { maxLength: 8 }), (def, n, seed, actions) => {
        const replay: Replay = { format: 1, game: def.id, rulesVersion: def.rulesVersion, level: levelOf(def, n), seed, actions, finalHash: '', finalPhase: 'playing' };
        expect(() => runReplay(def, replay)).not.toThrow();
      }),
      options,
    );
  });
});

describe('property 19: random numbers (5.1, 5.2, 5.3)', () => {
  it('stays in range and repeats from the same start', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4294967295 }), fc.integer({ min: 1, max: 65536 }), fc.integer({ min: 1, max: 20 }), (start, m, count) => {
        let a = start;
        let b = start;
        for (let i = 0; i < count; i++) {
          const x = i % 2 === 0 ? nextRandom(a) : randomInt(a, m);
          const y = i % 2 === 0 ? nextRandom(b) : randomInt(b, m);
          expect(x).toEqual(y);
          expect(Number.isInteger(x.value) && Number.isInteger(x.state)).toBe(true);
          expect(x.value).toBeGreaterThanOrEqual(0);
          expect(x.state).toBeGreaterThanOrEqual(0);
          expect(x.state).toBeLessThanOrEqual(4294967295);
          expect(x.value).toBeLessThanOrEqual(i % 2 === 0 ? 4294967295 : m - 1);
          a = x.state;
          b = y.state;
        }
      }),
      options,
    );
  });
});

const LAYERS: Layer[] = ['back', 'world', 'actors', 'fx', 'hud'];
const arbItem = fc.record({
  id: fc.uuid(),
  layer: fc.constantFrom(...LAYERS),
  text: fc.string(),
  kind: fc.constantFrom('rect', 'circle', 'sprite', 'text'),
});
function toItem(raw: { id: string; layer: Layer; text: string; kind: string }): SceneItem {
  switch (raw.kind) {
    case 'rect':
      return { kind: 'rect', id: raw.id, layer: raw.layer, x: 1, y: 1, w: 5, h: 5, fill: raw.text };
    case 'circle':
      return { kind: 'circle', id: raw.id, layer: raw.layer, cx: 5, cy: 5, r: 2, fill: raw.text };
    case 'sprite':
      return { kind: 'sprite', id: raw.id, layer: raw.layer, x: 1, y: 1, w: 5, h: 5, sprite: raw.text };
    default:
      return { kind: 'text', id: raw.id, layer: raw.layer, x: 1, y: 1, text: raw.text, size: 10, fill: '#000', align: 'left' };
  }
}

describe('property 20: paintSvg (6.2, 6.3, 6.4)', () => {
  it('draws in layer order then list order, escapes text, and draws a titled box for a missing sprite', () => {
    fc.assert(
      fc.property(fc.array(arbItem, { maxLength: 12 }), (raws) => {
        const items = raws.map(toItem);
        const scene: Scene = { width: 20, height: 20, items };
        const svg = paintSvg(scene);
        expect(svg.startsWith('<svg ')).toBe(true);
        expect(svg.endsWith('</svg>')).toBe(true);
        expect(svg.split('<svg').length).toBe(2);
        const order = [...svg.matchAll(/data-id="([^"]*)"/g)].map((m) => m[1]);
        const expected = LAYERS.flatMap((layer) => items.filter((i) => i.layer === layer).map((i) => i.id));
        expect(order).toEqual(expected);
        // Escaping: replacing every text and attribute value by a plain word leaves the same number of tags.
        const plain = paintSvg({ ...scene, items: raws.map((r) => toItem({ ...r, text: 'x' })) });
        expect((svg.match(/</g) ?? []).length).toBe((plain.match(/</g) ?? []).length);
        for (const item of items) {
          const value = item.kind === 'text' ? item.text : item.kind === 'sprite' ? item.sprite : '';
          const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          if (item.kind === 'text') expect(svg).toContain(`>${escaped}</text>`);
          if (item.kind === 'sprite') expect(svg).toContain(`<title>${escaped}</title>`);
        }
      }),
      options,
    );
  });
});

describe('property 21: validateScene and validateDef (6.5, 1.3)', () => {
  it('names a repeated id, a negative size and an item fully outside', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.integer({ min: 1, max: 50 }), (id, size) => {
        const rect = (rid: string, x: number, w: number): SceneItem => ({ kind: 'rect', id: rid, layer: 'world', x, y: 0, w, h: 5, fill: '#fff' });
        const scene = (items: SceneItem[]): Scene => ({ width: 100, height: 100, items });
        expect(validateScene(scene([rect(id, 0, size), rect(id, 0, size)])).join('\n')).toContain(id);
        expect(validateScene(scene([rect(id, 0, -size)])).join('\n')).toContain(id);
        expect(validateScene(scene([rect(id, 100 + size, size)])).join('\n')).toContain(id);
        expect(validateScene(scene([rect(id, 0, size)]))).toEqual([]);
      }),
      options,
    );
  });
  it('names each failing member of a definition', () => {
    fc.assert(
      fc.property(
        arbDef,
        fc.string().filter((s) => !/^[a-z0-9-]+$/.test(s)),
        fc.integer({ min: 121, max: 1000 }),
        (def, id, rate) => {
          expect(validateDef(def)).toEqual([]);
          expect(validateDef({ ...def, id }).some((p) => p.startsWith('id'))).toBe(true);
          expect(validateDef({ ...def, levels: () => [] }).some((p) => p.startsWith('levels'))).toBe(true);
          expect(validateDef({ ...def, levels: () => [{ id: 'a', title: '' }, { id: 'a', title: '' }] }).some((p) => p.startsWith('levels'))).toBe(true);
          expect(validateDef({ ...def, kind: 'tick', ticksPerSecond: rate }).some((p) => p.startsWith('ticksPerSecond'))).toBe(true);
          expect(validateDef({ ...def, kind: 'other' as 'turn' }).some((p) => p.startsWith('kind'))).toBe(true);
        },
      ),
      options,
    );
  });
});
