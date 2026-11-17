import { describe, expect, it } from 'vitest';
import type { Scene, SceneItem } from '@kit/core';
import type { EffectLayer, Pose, Slot } from './effects';
import { createPainter, type CanvasLike } from './painter';

type Call = [string, ...unknown[]];

function fakeCanvas(): { canvas: CanvasLike; calls: Call[] } {
  const calls: Call[] = [];
  const store: Record<string, unknown> = {};
  const ctx = new Proxy(store, {
    get: (target, key: string) => (key in target ? target[key] : (...args: unknown[]) => void calls.push([key, ...args])),
    set: (target, key: string, value) => {
      target[key] = value;
      calls.push([`set:${key}`, value]);
      return true;
    },
  });
  const canvas = { width: 0, height: 0, style: { width: '', height: '' }, dataset: {}, getContext: () => ctx } as unknown as CanvasLike;
  return { canvas, calls };
}

const sprite = (id: string, x: number, y: number): SceneItem => ({ kind: 'sprite', id, layer: 'actors', x, y, w: 20, h: 10, sprite: 's' });
const scene = (...items: SceneItem[]): Scene => ({ width: 100, height: 80, items });

interface Spy extends EffectLayer {
  log: string[];
  changes: [Scene | null, Scene, number][];
  slots: Slot[];
  next: { pose: Pose | null; owned: boolean; counts: Record<string, number> };
}

function spy(): Spy {
  const s: Spy = {
    log: [],
    changes: [],
    slots: [],
    next: { pose: null, owned: false, counts: {} },
    change(prev, next, now) {
      s.changes.push([prev, next, now]);
    },
    reset() {
      s.log.push('reset');
    },
    owns: () => s.next.owned,
    pose: () => s.next.pose,
    paint(_ctx, _now, slot) {
      s.slots.push(slot);
    },
    counts: () => s.next.counts,
    hold: { won: 900, lost: 300 },
  };
  return s;
}

const options = (effects: EffectLayer | undefined, reduced = false, animate = false) => ({
  devicePixelRatio: 1,
  reducedMotion: () => reduced,
  animate,
  sprite: () => ({}) as CanvasImageSource,
  ...(effects ? { effects } : {}),
});

describe('the painter and an effect layer', () => {
  it('gives the layer the scene before and the scene now', () => {
    const { canvas } = fakeCanvas();
    const fx = spy();
    const painter = createPainter(canvas, options(fx));
    const a = scene(sprite('a', 0, 0));
    const b = scene(sprite('a', 5, 0));
    painter.setScene(a, 10);
    painter.setScene(b, 20);
    expect(fx.changes).toEqual([
      [null, a, 10],
      [a, b, 20],
    ]);
  });

  it('forgets the scene before after a reset, and tells the layer', () => {
    const { canvas } = fakeCanvas();
    const fx = spy();
    const painter = createPainter(canvas, options(fx));
    painter.setScene(scene(sprite('a', 0, 0)), 0);
    painter.reset();
    const b = scene(sprite('a', 5, 0));
    painter.setScene(b, 5);
    expect(fx.log).toEqual(['reset']);
    expect(fx.changes[1]?.[0]).toBeNull();
  });

  it('calls the layer after the start and after each layer of items, in order', () => {
    const { canvas } = fakeCanvas();
    const fx = spy();
    const painter = createPainter(canvas, options(fx));
    painter.setScene(scene(sprite('a', 0, 0)), 0);
    painter.paint(0);
    expect(fx.slots).toEqual(['start', 'back', 'world', 'actors', 'fx', 'hud']);
  });

  it('draws a posed sprite about its centre and keeps its box in data-scene', () => {
    const { canvas, calls } = fakeCanvas();
    const fx = spy();
    fx.next.pose = { dx: 7, dy: -3, sx: 0.5 };
    const painter = createPainter(canvas, options(fx));
    painter.setScene(scene(sprite('a', 10, 20)), 0);
    painter.paint(0);
    expect(calls).toContainEqual(['translate', 10 + 10 + 7, 20 + 5 - 3]);
    expect(calls).toContainEqual(['scale', 0.5, 1]);
    expect(calls.find((c) => c[0] === 'drawImage')).toEqual(['drawImage', {}, 10, 20, 20, 10]);
    expect(JSON.parse(canvas.dataset.scene ?? '[]')).toEqual([{ id: 'a', x: 10, y: 20, w: 20, h: 10 }]);
  });

  it('multiplies the alpha of an item by the alpha of its pose', () => {
    const { canvas, calls } = fakeCanvas();
    const fx = spy();
    fx.next.pose = { alpha: 0.5 };
    const painter = createPainter(canvas, options(fx));
    painter.setScene(scene({ kind: 'sprite', id: 'a', layer: 'actors', x: 0, y: 0, w: 20, h: 10, sprite: 's', opacity: 0.5 }), 0);
    painter.paint(0);
    expect(calls).toContainEqual(['set:globalAlpha', 0.25]);
  });

  it('draws a wrapped strip again on each side of the view, mirrored', () => {
    const { canvas, calls } = fakeCanvas();
    const fx = spy();
    fx.next.pose = { dx: -30, wrap: 100 };
    const painter = createPainter(canvas, options(fx));
    painter.setScene(scene({ kind: 'sprite', id: 'hills', layer: 'back', x: 0, y: 0, w: 100, h: 10, sprite: 's' }), 0);
    painter.paint(0);
    const drawn = calls.filter((c) => c[0] === 'drawImage').map((c) => c[2] as number);
    expect(drawn.length).toBeGreaterThanOrEqual(2);
    expect(calls.filter((c) => c[0] === 'scale' && c[1] === -1).length).toBeGreaterThanOrEqual(1);
  });

  it('does not glide an item the layer owns', () => {
    const { canvas, calls } = fakeCanvas();
    const fx = spy();
    fx.next.owned = true;
    const painter = createPainter(canvas, options(fx, false, true));
    painter.setScene(scene(sprite('a', 0, 0)), 0);
    painter.setScene(scene(sprite('a', 50, 0)), 100);
    painter.paint(110);
    expect(calls.find((c) => c[0] === 'drawImage')?.[2]).toBe(50);
  });

  it('still glides an item the layer does not own', () => {
    const { canvas, calls } = fakeCanvas();
    const fx = spy();
    const painter = createPainter(canvas, options(fx, false, true));
    painter.setScene(scene(sprite('a', 0, 0)), 0);
    painter.setScene(scene(sprite('a', 50, 0)), 100);
    painter.paint(110);
    const x = calls.find((c) => c[0] === 'drawImage')?.[2] as number;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(50);
  });

  it('publishes the count of the layer in data-effects and the kinds in data-effect-kinds', () => {
    const { canvas } = fakeCanvas();
    const fx = spy();
    fx.next.counts = { dust: 3, spark: 4 };
    const painter = createPainter(canvas, options(fx));
    painter.setScene(scene(sprite('a', 0, 0)), 0);
    painter.paint(0);
    expect(canvas.dataset.effects).toBe('7');
    expect(JSON.parse(canvas.dataset.effectKinds ?? '{}')).toEqual({ dust: 3, spark: 4 });
  });

  it('with reduced motion calls the layer for nothing, poses nothing and publishes 0', () => {
    const { canvas, calls } = fakeCanvas();
    const fx = spy();
    fx.next.pose = { dx: 9 };
    fx.next.counts = { dust: 3 };
    const painter = createPainter(canvas, options(fx, true));
    painter.setScene(scene(sprite('a', 10, 20)), 0);
    painter.paint(0);
    expect(fx.changes).toEqual([]);
    expect(fx.slots).toEqual([]);
    expect(calls.filter((c) => c[0] === 'translate')).toEqual([]);
    expect(canvas.dataset.effects).toBe('0');
  });

  it('sets no data-effects when the painter has no layer', () => {
    const { canvas } = fakeCanvas();
    const painter = createPainter(canvas, options(undefined));
    painter.setScene(scene(sprite('a', 0, 0)), 0);
    painter.paint(0);
    expect(canvas.dataset.effects).toBeUndefined();
  });

  it('tells the hold of the layer, and none when reduced or without a layer', () => {
    const fx = spy();
    expect(createPainter(fakeCanvas().canvas, options(fx)).hold()).toEqual({ won: 900, lost: 300 });
    expect(createPainter(fakeCanvas().canvas, options(fx, true)).hold()).toBeNull();
    expect(createPainter(fakeCanvas().canvas, options(undefined)).hold()).toBeNull();
  });

  it('sizes the canvas once and again only when the size changes', () => {
    const { canvas } = fakeCanvas();
    let writes = 0;
    let width = 0;
    Object.defineProperty(canvas, 'width', {
      get: () => width,
      set: (v: number) => {
        writes += 1;
        width = v;
      },
    });
    const painter = createPainter(canvas, options(undefined));
    painter.setScene(scene(sprite('a', 0, 0)), 0);
    painter.paint(0);
    painter.paint(16);
    painter.paint(32);
    expect(writes).toBe(1);
    expect(width).toBe(100);
  });
});
