import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSession, expandActions } from '@kit/core';
import { describe, expect, it } from 'vitest';
import def from './def';
import { runnerInput } from './input';
import { obstacleWindows } from './proof';

// The words a screen reader hears for the runner. They come only when the state changes in words.
const proofPath = (id: string): string => fileURLToPath(new URL(`../../../proofs/runner/${id}.json`, import.meta.url));
const actionsOf = (id: string): string[] => {
  const proof = JSON.parse(readFileSync(proofPath(id), 'utf8')) as { replay: { actions: string[] } };
  const expanded = expandActions(proof.replay.actions);
  if (!expanded.ok) throw new Error(expanded.message);
  return expanded.actions;
};

interface Heard { tick: number; text: string }

function listen(id: string): Heard[] {
  const session = createSession(def, id, 1);
  const heard: Heard[] = [];
  const first = runnerInput.narrate!(session.state, null, session.status());
  if (first) heard.push({ tick: 0, text: first });
  for (const action of actionsOf(id)) {
    const before = session.state;
    session.apply(action);
    const text = runnerInput.narrate!(session.state, before, session.status());
    if (text) heard.push({ tick: session.tick, text });
  }
  return heard;
}

describe('runner narration', () => {
  it('says the run started, once', () => {
    const heard = listen('r01');
    expect(heard[0]).toEqual({ tick: 0, text: 'Run started.' });
    expect(heard.filter((h) => h.text.includes('Run started'))).toHaveLength(1);
  });

  it('says nothing on most ticks', () => {
    const heard = listen('r01');
    expect(heard.length).toBeLessThan(actionsOf('r01').length / 10);
  });

  it('says Jump now at the first tick a jump still clears the first gap, and only there', () => {
    const windows = obstacleWindows(def as never, 'r01', actionsOf('r01'));
    const firstGood = windows[0]!.goodTicks[0]!;
    const heard = listen('r01');
    const jumps = heard.filter((h) => h.text.includes('Jump now'));
    const atFirstGap = jumps.filter((h) => h.tick < firstGood + windows[0]!.window);
    expect(atFirstGap).toHaveLength(1);
    expect(atFirstGap[0]!.tick).toBe(firstGood);
  });

  it('warns of the gap before it says Jump now', () => {
    const heard = listen('r01');
    const ahead = heard.findIndex((h) => h.text.includes('Gap ahead'));
    const now = heard.findIndex((h) => h.text.includes('Jump now'));
    expect(ahead).toBeGreaterThanOrEqual(0);
    expect(ahead).toBeLessThan(now);
  });

  it('says Landed after a jump', () => {
    expect(listen('r01').some((h) => h.text.includes('Landed'))).toBe(true);
  });

  it('says the gate is reached at the end of a won run', () => {
    const heard = listen('r01');
    expect(heard[heard.length - 1]!.text).toContain('Reached the gate.');
  });

  it('says Fell when the run is lost in a gap', () => {
    const session = createSession(def, 'r01', 1);
    let text: string | null = null;
    while (session.status().phase === 'playing') {
      const before = session.state;
      session.apply('none');
      text = runnerInput.narrate!(session.state, before, session.status());
    }
    expect(text).toContain('Fell in a gap.');
  });

  it('says nothing twice for the same change', () => {
    const heard = listen('r01');
    for (const word of ['Gap ahead', 'Jump now']) {
      const ticks = heard.filter((h) => h.text.includes(word)).map((h) => h.tick);
      expect(new Set(ticks).size).toBe(ticks.length);
    }
  });
});
