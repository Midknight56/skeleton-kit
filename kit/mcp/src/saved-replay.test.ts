import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runReplay, type GameDef, type Json, type Replay } from '@kit/core';
import sampleLights from '../test-fixtures/sample-lights/def';
import { makeContext, okValue } from './test-helpers';
import { replay as replayTool } from './tools';

const dir = join(__dirname, '..', 'test-fixtures', 'sample-lights', 'tests', 'replays');
const def = sampleLights as unknown as GameDef<Json, unknown>;
const name = 'sample-lights-l2-6ccb2c6a8194c8ac.json';

function load(): Replay {
  return JSON.parse(readFileSync(join(dir, name), 'utf8')) as Replay;
}

describe('saved replay from the playtester run', () => {
  it('is in the replays folder', () => {
    expect(readdirSync(dir)).toContain(name);
  });

  it('passes runReplay and ends won', () => {
    const saved = load();
    expect(saved.level).toBe('l2');
    expect(saved.finalPhase).toBe('won');
    expect(runReplay(def, saved)).toEqual({ ok: true, finalHash: '6ccb2c6a8194c8ac', finalPhase: 'won' });
  });

  it('passes the replay tool when given as an object', () => {
    const value = okValue(replayTool(makeContext(sampleLights), { replay: load() }));
    expect(value).toMatchObject({ ok: true, finalHash: '6ccb2c6a8194c8ac', finalPhase: 'won' });
  });

  it('fails runReplay when the final hash is changed', () => {
    const result = runReplay(def, { ...load(), finalHash: '0000000000000000' });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: 'hash_mismatch' });
  });

  it('fails runReplay when an action is removed', () => {
    const saved = load();
    const result = runReplay(def, { ...saved, actions: saved.actions.slice(0, 1) });
    expect(result.ok).toBe(false);
  });
});