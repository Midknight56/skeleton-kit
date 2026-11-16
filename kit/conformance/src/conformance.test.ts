import { runReplay } from '@kit/core';
import type { GameDef, Json } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { brokenChangedInput } from '../broken/changed-input';
import { brokenHiddenCounter } from '../broken/hidden-counter';
import { brokenUnlistedAction } from '../broken/unlisted-action';
import { runConformance, sampleHop, sampleLights, type PropertyResult } from './index';

const NAMES = [
  'repeatable',
  'replay-round-trip',
  'legal-closure',
  'plain-data',
  'input-not-changed',
  'game-over-is-final',
  'action-text-round-trip',
  'undo',
  'view-and-observation-safe',
];

const failing = (results: PropertyResult[]): string[] => results.filter((r) => !r.passed).map((r) => r.name);

describe('runConformance on the sample games', () => {
  it.each([
    ['sample-lights', sampleLights],
    ['sample-hop', sampleHop],
  ] as [string, GameDef<Json, unknown>][])('%s passes all nine properties', (_name, def) => {
    const results = runConformance(def);
    expect(results.map((r) => r.name)).toEqual(NAMES);
    expect(failing(results)).toEqual([]);
    for (const r of results) expect(r.counterexample).toBeUndefined();
  });

  it('repeats the same results for the same options', () => {
    expect(runConformance(sampleLights, { runs: 10, seed: 3 })).toEqual(runConformance(sampleLights, { runs: 10, seed: 3 }));
  });
});

describe('runConformance on the broken samples', () => {
  it('fails the hidden counter sample on property 1 (repeatable)', () => {
    // A counter outside the state also makes the replay run end in another hash, so property 2 fails with it.
    // Two runs of the same game cannot be told apart by their cause, so the design's "exactly" holds only for the other two samples.
    const names = failing(runConformance(brokenHiddenCounter as GameDef<Json, unknown>));
    expect(names[0]).toBe('repeatable');
    expect(names).toEqual(['repeatable', 'replay-round-trip']);
  });

  it('fails the changed input sample on property 5 (input-not-changed)', () => {
    expect(failing(runConformance(brokenChangedInput as GameDef<Json, unknown>))).toEqual(['input-not-changed']);
  });

  it('fails the unlisted action sample on property 3 (legal-closure)', () => {
    expect(failing(runConformance(brokenUnlistedAction as GameDef<Json, unknown>))).toEqual(['legal-closure']);
  });
});

describe('a failing result', () => {
  const def = brokenUnlistedAction as GameDef<Json, unknown>;
  const result = runConformance(def).find((r) => r.name === 'legal-closure') as PropertyResult;

  it('holds the property name, a message, and a counterexample in replay form', () => {
    expect(result.passed).toBe(false);
    expect(result.message ?? '').toContain('legal-closure');
    const c = result.counterexample;
    expect(c).toBeDefined();
    expect(c?.format).toBe(1);
    expect(c?.game).toBe('broken-unlisted-action');
    expect(c?.rulesVersion).toBe('1');
    expect(c?.level).toBe('b1');
    expect(Number.isInteger(c?.seed)).toBe(true);
    expect(Array.isArray(c?.actions)).toBe(true);
    expect(c?.finalHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('shrinks the action list to the shortest run that shows the fault', () => {
    // `dec` is legal at n = 1 and not at n = 0, so the shortest run is inc then dec.
    expect(result.counterexample?.actions).toEqual(['inc', 'dec']);
    expect(result.counterexample?.seed).toBe(0);
  });

  it('gives a replay that the core can run', () => {
    const c = result.counterexample;
    if (c === undefined) throw new Error('no counterexample');
    expect(runReplay(def, c)).toMatchObject({ ok: true });
  });

  it('shrinks the hidden counter run to no actions', () => {
    const r = runConformance(brokenHiddenCounter as GameDef<Json, unknown>).find((p) => p.name === 'repeatable') as PropertyResult;
    expect(r.counterexample?.actions).toEqual([]);
    expect(r.counterexample?.level).toBe('b1');
  });
});

describe('options', () => {
  it('uses runs and maxActions', () => {
    // With maxActions 1 the shortest fault run (two actions) cannot occur.
    const results = runConformance(brokenUnlistedAction as GameDef<Json, unknown>, { maxActions: 1 });
    expect(failing(results)).toEqual([]);
  });
});
