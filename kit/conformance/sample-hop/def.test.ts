import { expandActions, hashState } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { sampleHop, type HopAction, type HopState } from './def';

function play(level: string, texts: string[]): { state: HopState; ticks: number } {
  let state = sampleHop.init(level, 0);
  let ticks = 0;
  for (const text of texts) {
    if (sampleHop.status(state).phase !== 'playing') break;
    const action = sampleHop.decodeAction(text);
    if (action === null) throw new Error(`bad text ${text}`);
    state = sampleHop.step(state, action);
    ticks++;
  }
  return { state, ticks };
}

function expand(items: string[]): string[] {
  const result = expandActions(items);
  if (!result.ok) throw new Error(result.message);
  return result.actions;
}

// Hop when the next cell is blocked and the runner is on the ground.
function greedy(level: string): { state: HopState; ticks: number } {
  let state = sampleHop.init(level, 0);
  let ticks = 0;
  while (sampleHop.status(state).phase === 'playing' && ticks < 100) {
    const action: HopAction = state.air === 0 && state.blocked.includes(state.cell + 1) ? 'hop' : 'none';
    state = sampleHop.step(state, action);
    ticks++;
  }
  return { state, ticks };
}

describe('sample-hop definition', () => {
  it('has the id, the kind, 10 ticks a second and two levels', () => {
    expect(sampleHop.id).toBe('sample-hop');
    expect(sampleHop.kind).toBe('tick');
    expect(sampleHop.ticksPerSecond).toBe(10);
    expect(sampleHop.levels().map((level) => level.id)).toEqual(['h1', 'h2']);
  });

  it('starts on cell 0 with no airborne tick and one blocked cell, 10, on h1', () => {
    expect(sampleHop.init('h1', 0)).toEqual({ cell: 0, air: 0, blocked: [10], lost: false });
    expect(sampleHop.status(sampleHop.init('h1', 0)).phase).toBe('playing');
  });

  it('wins h1 with the design replay in 39 ticks', () => {
    const run = play('h1', expand(['none*6', 'hop', 'none*32']));
    expect(run.ticks).toBe(39);
    expect(run.state.cell).toBe(39);
    expect(sampleHop.status(run.state).phase).toBe('won');
  });

  it('is lost on cell 10 at tick 10 when it never hops', () => {
    const run = play('h1', new Array<string>(60).fill('none'));
    expect(run.ticks).toBe(10);
    expect(run.state.cell).toBe(10);
    expect(sampleHop.status(run.state).phase).toBe('lost');
  });

  it('keeps the runner airborne for 4 ticks and not longer', () => {
    let state = sampleHop.step(sampleHop.init('h1', 0), 'hop');
    expect(state).toMatchObject({ cell: 1, air: 3 });
    state = sampleHop.step(state, 'none');
    state = sampleHop.step(state, 'none');
    state = sampleHop.step(state, 'none');
    expect(state).toMatchObject({ cell: 4, air: 0 });
  });

  it('does not restart a hop while airborne', () => {
    let state = sampleHop.step(sampleHop.init('h1', 0), 'hop');
    state = sampleHop.step(state, 'hop');
    expect(state).toMatchObject({ cell: 2, air: 2 });
  });

  it('can be won on both levels by a hop just before each blocked cell', () => {
    for (const { id } of sampleHop.levels()) {
      const run = greedy(id);
      expect(sampleHop.status(run.state).phase, id).toBe('won');
      expect(run.state.cell).toBe(39);
    }
  });

  it('keeps every number in state an integer', () => {
    const run = play('h2', expand(['none*5', 'hop', 'none*3']));
    const numbers = [run.state.cell, run.state.air, ...run.state.blocked];
    expect(numbers.every((n) => Number.isInteger(n))).toBe(true);
  });

  it('lists none and hop while playing and nothing after the end', () => {
    expect(sampleHop.actions(sampleHop.init('h1', 0))).toEqual(['none', 'hop']);
    expect(sampleHop.actions(play('h1', new Array<string>(60).fill('none')).state)).toEqual([]);
  });

  it('decodes only none and hop', () => {
    expect(sampleHop.decodeAction('none')).toBe('none');
    expect(sampleHop.decodeAction('hop')).toBe('hop');
    for (const text of ['Hop', 'jump', '', 'hop ', 'hop*2']) expect(sampleHop.decodeAction(text), text).toBeNull();
    expect(sampleHop.encodeAction('hop')).toBe('hop');
  });

  it('leaves its input unchanged and ignores an action after the end', () => {
    const state = sampleHop.init('h1', 0);
    const before = hashState(state);
    sampleHop.step(state, 'hop');
    expect(hashState(state)).toBe(before);
    const lost = play('h1', new Array<string>(60).fill('none')).state;
    expect(hashState(sampleHop.step(lost, 'hop'))).toBe(hashState(lost));
  });

  it('observes with a 40 cell text map and a short summary', () => {
    const view = sampleHop.observe(sampleHop.init('h1', 0));
    expect(view.summary.length).toBeLessThanOrEqual(120);
    expect(view.textMap).toHaveLength(1);
    expect(view.textMap?.[0]).toHaveLength(40);
    expect(view.facts).toMatchObject({ cell: 0, air: 0 });
  });

  it('paints a scene with unique ids', () => {
    const scene = sampleHop.view(sampleHop.init('h2', 0), {
      width: 640, height: 360, safe: { top: 16, right: 16, bottom: 16, left: 16 },
    });
    expect(new Set(scene.items.map((item) => item.id)).size).toBe(scene.items.length);
    expect(scene.items.some((item) => item.id === 'runner')).toBe(true);
  });
});
