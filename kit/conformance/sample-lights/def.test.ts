import { hashState } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { sampleLights, type LightsAction, type LightsState } from './def';

const off: LightsState = { lamps: [0, 0, 0, 0, 0, 0, 0, 0, 0], moves: 0 };

// An all-on board is still being played, so presses count. The diff shows which lamps a press flips.
const busy: LightsState = { lamps: [1, 1, 1, 1, 1, 1, 1, 1, 1], moves: 0 };

function flipped(state: LightsState, action: LightsAction): number[] {
  const next = sampleLights.step(state, action);
  return next.lamps.flatMap((lamp, i) => (lamp !== state.lamps[i] ? [i] : []));
}

describe('sample-lights definition', () => {
  it('has the id, the kind and three levels', () => {
    expect(sampleLights.id).toBe('sample-lights');
    expect(sampleLights.kind).toBe('turn');
    expect(sampleLights.levels().map((level) => level.id)).toEqual(['l1', 'l2', 'l3']);
  });

  it('starts every level with at least one lamp on and the phase playing', () => {
    for (const { id } of sampleLights.levels()) {
      const state = sampleLights.init(id, 0);
      expect(state.lamps).toHaveLength(9);
      expect(state.lamps.some((lamp) => lamp === 1), id).toBe(true);
      expect(sampleLights.status(state).phase).toBe('playing');
    }
  });

  it('starts l1 with the centre lamp and its four neighbours on and the corners off', () => {
    expect(sampleLights.init('l1', 0).lamps).toEqual([0, 1, 0, 1, 1, 1, 0, 1, 0]);
  });

  it('wins l1 with press:1,1', () => {
    const state = sampleLights.step(sampleLights.init('l1', 0), { x: 1, y: 1 });
    expect(state.lamps).toEqual(off.lamps);
    expect(sampleLights.status(state)).toMatchObject({ phase: 'won' });
    expect(sampleLights.actions(state)).toEqual([]);
  });

  it('flips 3 lamps for a corner, 4 for an edge and 5 for the centre', () => {
    expect(flipped(busy, { x: 0, y: 0 })).toEqual([0, 1, 3]);
    expect(flipped(busy, { x: 2, y: 2 })).toEqual([5, 7, 8]);
    expect(flipped(busy, { x: 1, y: 0 })).toEqual([0, 1, 2, 4]);
    expect(flipped(busy, { x: 0, y: 1 })).toEqual([0, 3, 4, 6]);
    expect(flipped(busy, { x: 1, y: 1 })).toEqual([1, 3, 4, 5, 7]);
  });

  it('counts the moves and presses the same cell twice to undo it', () => {
    const start = sampleLights.init('l2', 0);
    const once = sampleLights.step(start, { x: 0, y: 2 });
    expect(once.moves).toBe(1);
    expect(sampleLights.step(once, { x: 0, y: 2 }).lamps).toEqual(start.lamps);
  });

  it('lists the nine presses in row order while playing', () => {
    const texts = sampleLights.actions(sampleLights.init('l3', 0)).map((a) => sampleLights.encodeAction(a));
    expect(texts).toEqual([
      'press:0,0', 'press:1,0', 'press:2,0',
      'press:0,1', 'press:1,1', 'press:2,1',
      'press:0,2', 'press:1,2', 'press:2,2',
    ]);
  });

  it('decodes only the nine press texts', () => {
    expect(sampleLights.decodeAction('press:2,1')).toEqual({ x: 2, y: 1 });
    for (const text of ['press:3,0', 'press:0,3', 'press:1', 'press:1,1,1', 'Press:1,1', 'press: 1,1', 'press:-1,0', '', 'none']) {
      expect(sampleLights.decodeAction(text), text).toBeNull();
    }
  });

  it('leaves its input unchanged and ignores an unlisted action', () => {
    const state = sampleLights.init('l3', 0);
    const before = hashState(state);
    sampleLights.step(state, { x: 1, y: 1 });
    expect(hashState(state)).toBe(before);
    expect(hashState(sampleLights.step(state, { x: 5, y: 5 }))).toBe(before);
    const won = sampleLights.step(sampleLights.init('l1', 0), { x: 1, y: 1 });
    expect(hashState(sampleLights.step(won, { x: 0, y: 0 }))).toBe(hashState(won));
  });

  it('observes with a short summary and a 3x3 text map', () => {
    const view = sampleLights.observe(sampleLights.init('l1', 0));
    expect(view.summary.length).toBeLessThanOrEqual(120);
    expect(view.textMap).toHaveLength(3);
    expect(view.textMap?.every((row) => row.length === 3)).toBe(true);
    expect(view.facts).toMatchObject({ lampsOn: 5, moves: 0 });
  });

  it('paints one lamp item for each cell inside the scene', () => {
    const scene = sampleLights.view(sampleLights.init('l1', 0), {
      width: 360, height: 640, safe: { top: 16, right: 16, bottom: 16, left: 16 },
    });
    expect(scene.width).toBe(360);
    expect(scene.items.filter((item) => item.id.startsWith('lamp-'))).toHaveLength(9);
    expect(new Set(scene.items.map((item) => item.id)).size).toBe(scene.items.length);
  });
});
