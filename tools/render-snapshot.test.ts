import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expandActions, type GameDef, type Json } from '@kit/core';
import { describe, expect, it } from 'vitest';
import gardenDef from '../apps/garden/src/def';
import runnerDef from '../apps/runner/src/def';
import { createStore } from '../kit/mcp/src/store';
import { act, newGame, render, type ToolContext } from '../kit/mcp/src/tools';

// The tool door draws the game picture with no effects. The effects of the browser are drawing only,
// so the SVG text of a fixed replay must not change. Each entry holds the length in bytes and the
// SHA-256 of the text the tool door gave before the effects were added.
function proofActions(game: string, level: string): string[] {
  const path = fileURLToPath(new URL(`../proofs/${game}/${level}.json`, import.meta.url));
  const proof = JSON.parse(readFileSync(path, 'utf8')) as { replay: { actions: string[] } };
  const expanded = expandActions(proof.replay.actions);
  if (!expanded.ok) throw new Error(expanded.message);
  return expanded.actions;
}

function svgAt(def: unknown, level: string, actions: string[]): string {
  const ctx: ToolContext = { def: def as GameDef<Json, unknown>, store: createStore(), appDir: '.' };
  const started = newGame(ctx, { level });
  const session = (started as { ok: true; value: { session: string } }).value.session;
  if (actions.length > 0) {
    const acted = act(ctx, { session, actions });
    expect(acted.ok).toBe(true);
  }
  const drawn = render(ctx, { session, format: 'svg' });
  expect(drawn.ok).toBe(true);
  return (drawn as { ok: true; text: string }).text;
}

function fingerprint(text: string): { bytes: number; sha256: string } {
  return { bytes: Buffer.byteLength(text, 'utf8'), sha256: createHash('sha256').update(text, 'utf8').digest('hex') };
}

describe('the tool door render output has no effects', () => {
  it('draws the garden puzzle level g01 at tick 0 as before', () => {
    expect(fingerprint(svgAt(gardenDef, 'g01', []))).toEqual({ bytes: 921, sha256: '98a80c00a6960734a728a99ee58cf3b439ecf7d546e48aad0174831366e94ee1' });
  });

  it('draws the garden puzzle level g01 at tick 1 as before', () => {
    expect(fingerprint(svgAt(gardenDef, 'g01', proofActions('garden', 'g01').slice(0, 1)))).toEqual({ bytes: 924, sha256: '16c6e2e6bc7c2f1594f5c3db42fec4a004c8accfcf1aedc0eafdf634135f1c89' });
  });

  it('draws the garden puzzle level g01 at the win as before', () => {
    expect(fingerprint(svgAt(gardenDef, 'g01', proofActions('garden', 'g01')))).toEqual({ bytes: 930, sha256: '31774445ea24bcc595d01bb441a2f6dc87ca6a9879dba33472f5aca539f2680f' });
  });

  it('draws the runner course r01 at tick 0 as before', () => {
    expect(fingerprint(svgAt(runnerDef, 'r01', []))).toEqual({ bytes: 3097, sha256: '3667bdcf59f26bb2da7e52f5b4889a2a416fcd0b608bc9c310e23902dd8a7614' });
  });

  it('draws the runner course r01 at tick 120 as before', () => {
    expect(fingerprint(svgAt(runnerDef, 'r01', proofActions('runner', 'r01').slice(0, 120)))).toEqual({ bytes: 3569, sha256: 'ccf78dd484570484347a1747d8708ce828a7aacfca7beb86a9958ebb14879896' });
  });
});
