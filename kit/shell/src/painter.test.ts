import { describe, expect, it } from 'vitest';
import type { Scene, SceneItem } from '@kit/core';
import { createPainter, hudTextBoxes, itemIdsAt, sceneBoxes, type CanvasLike, type Ctx2D } from './painter';

type Call = [string, ...unknown[]];

class RecordingContext implements Ctx2D {
  calls: Call[] = [];
  private props: Record<string, unknown> = {};
  private define(name: string, value: unknown): void {
    this.props[name] = value;
    this.calls.push(['set:' + name, value]);
  }
  get fillStyle(): string {
    return String(this.props.fillStyle ?? '');
  }
  set fillStyle(v: string) {
    this.define('fillStyle', v);
  }
  get globalAlpha(): number {
    return Number(this.props.globalAlpha ?? 1);
  }
  set globalAlpha(v: number) {
    this.define('globalAlpha', v);
  }
  get font(): string {
    return String(this.props.font ?? '');
  }
  set font(v: string) {
    this.define('font', v);
  }
  get textAlign(): CanvasTextAlign {
    return (this.props.textAlign as CanvasTextAlign) ?? 'left';
  }
  set textAlign(v: CanvasTextAlign) {
    this.define('textAlign', v);
  }
  setTransform(...a: number[]): void { this.calls.push(['setTransform', ...a]); }
  translate(...a: number[]): void { this.calls.push(['translate', ...a]); }
  scale(...a: number[]): void { this.calls.push(['scale', ...a]); }
  save(): void { this.calls.push(['save']); }
  restore(): void { this.calls.push(['restore']); }
  clearRect(...a: number[]): void { this.calls.push(['clearRect', ...a]); }
  fillRect(...a: number[]): void { this.calls.push(['fillRect', ...a]); }
  beginPath(): void { this.calls.push(['beginPath']); }
  moveTo(...a: number[]): void { this.calls.push(['moveTo', ...a]); }
  arcTo(...a: number[]): void { this.calls.push(['arcTo', ...a]); }
  arc(...a: number[]): void { this.calls.push(['arc', ...a]); }
  closePath(): void { this.calls.push(['closePath']); }
  fill(): void { this.calls.push(['fill']); }
  fillText(...a: unknown[]): void { this.calls.push(['fillText', ...a]); }
  drawImage(...a: unknown[]): void { this.calls.push(['drawImage', ...a]); }
  fillStyles(): string[] {
    return this.calls.filter((c) => c[0] === 'set:fillStyle').map((c) => String(c[1]));
  }
  count(name: string): number {
    return this.calls.filter((c) => c[0] === name).length;
  }
}

function fakeCanvas(): { canvas: CanvasLike; ctx: RecordingContext } {
  const ctx = new RecordingContext();
  const canvas: CanvasLike = {
    width: 0,
    height: 0,
    style: { width: '', height: '' },
    dataset: {},
    getContext: () => ctx,
  };
  return { canvas, ctx };
}

const rect = (id: string, layer: SceneItem['layer'], x: number, y: number, fill = '#111111', w = 10, h = 10): SceneItem => ({ kind: 'rect', id, layer, x, y, w, h, fill });
const scene = (items: SceneItem[]): Scene => ({ width: 100, height: 80, items });

describe('itemIdsAt', () => {
  it('gives the actors id before the world id and skips an fx circle', () => {
    const s = scene([
      rect('item-world', 'world', 10, 10),
      rect('item-actor', 'actors', 10, 10),
      { kind: 'circle', id: 'item-glow', layer: 'fx', cx: 15, cy: 15, r: 40, fill: '#ffffff' },
    ]);
    expect(itemIdsAt(s, 12, 12)).toEqual(['item-actor', 'item-world']);
  });

  it('puts a later item of one layer above an earlier one', () => {
    const s = scene([rect('item-a', 'world', 0, 0), rect('item-b', 'world', 0, 0)]);
    expect(itemIdsAt(s, 1, 1)).toEqual(['item-b', 'item-a']);
  });

  it('skips hud items and text items', () => {
    const s = scene([
      rect('item-bar', 'hud', 0, 0, '#000000', 100, 20),
      { kind: 'text', id: 'item-label', layer: 'world', x: 5, y: 5, text: 'x', size: 12, fill: '#ffffff', align: 'left' },
    ]);
    expect(itemIdsAt(s, 5, 5)).toEqual([]);
  });

  it('holds the left and top edge and not the right edge', () => {
    const s = scene([rect('item-a', 'world', 10, 10)]);
    expect(itemIdsAt(s, 10, 10)).toEqual(['item-a']);
    expect(itemIdsAt(s, 19.9, 19.9)).toEqual(['item-a']);
    expect(itemIdsAt(s, 20, 15)).toEqual([]);
    expect(itemIdsAt(s, 15, 20)).toEqual([]);
    expect(itemIdsAt(s, 9.9, 15)).toEqual([]);
  });

  it('tests a circle by its own radius, not its box corner', () => {
    const s = scene([{ kind: 'circle', id: 'item-c', layer: 'world', cx: 50, cy: 50, r: 10, fill: '#ffffff' }]);
    expect(itemIdsAt(s, 50, 41)).toEqual(['item-c']);
    expect(itemIdsAt(s, 41, 41)).toEqual([]);
  });

  it('finds a sprite', () => {
    const s = scene([{ kind: 'sprite', id: 'item-s', layer: 'actors', x: 0, y: 0, w: 20, h: 20, sprite: 'one' }]);
    expect(itemIdsAt(s, 19, 19)).toEqual(['item-s']);
  });
});

describe('sceneBoxes', () => {
  it('lists every item with a box and none of the text items', () => {
    const s = scene([
      rect('item-a', 'world', 1, 2, '#111111', 3, 4),
      { kind: 'circle', id: 'item-c', layer: 'fx', cx: 10, cy: 10, r: 5, fill: '#fff' },
      { kind: 'text', id: 'item-t', layer: 'hud', x: 0, y: 0, text: 'x', size: 10, fill: '#fff', align: 'left' },
    ]);
    expect(sceneBoxes(s)).toEqual([
      { id: 'item-a', x: 1, y: 2, w: 3, h: 4 },
      { id: 'item-c', x: 5, y: 5, w: 10, h: 10 },
    ]);
  });
});

describe('createPainter drawing', () => {
  it('draws in layer order and then list order', () => {
    const { canvas, ctx } = fakeCanvas();
    const painter = createPainter(canvas, { devicePixelRatio: 1, reducedMotion: () => false, animate: false, sprite: () => undefined });
    painter.setScene(
      scene([rect('i-hud', 'hud', 0, 0, '#a00001'), rect('i-fx', 'fx', 0, 0, '#a00002'), rect('i-actor', 'actors', 0, 0, '#a00003'), rect('i-world-1', 'world', 0, 0, '#a00004'), rect('i-back', 'back', 0, 0, '#a00005'), rect('i-world-2', 'world', 0, 0, '#a00006')]),
      0,
    );
    painter.paint(0);
    const order = ctx.fillStyles().filter((f) => f.startsWith('#a000'));
    expect(order).toEqual(['#a00005', '#a00004', '#a00006', '#a00003', '#a00002', '#a00001']);
  });

  it('sizes the canvas for the device pixel ratio', () => {
    const { canvas, ctx } = fakeCanvas();
    const painter = createPainter(canvas, { devicePixelRatio: 2, reducedMotion: () => false, animate: false, sprite: () => undefined });
    painter.setScene(scene([rect('i-a', 'world', 0, 0)]), 0);
    painter.paint(0);
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(160);
    expect(canvas.style.width).toBe('100px');
    expect(canvas.style.height).toBe('80px');
    expect(ctx.calls.find((c) => c[0] === 'setTransform')).toEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
  });

  it('draws a rounded rectangle when the sprite image is missing', () => {
    const { canvas, ctx } = fakeCanvas();
    const painter = createPainter(canvas, { devicePixelRatio: 1, reducedMotion: () => false, animate: false, sprite: () => undefined });
    painter.setScene(scene([{ kind: 'sprite', id: 'i-s', layer: 'actors', x: 0, y: 0, w: 20, h: 20, sprite: 'missing' }]), 0);
    painter.paint(0);
    expect(ctx.count('drawImage')).toBe(0);
    expect(ctx.count('arcTo')).toBeGreaterThanOrEqual(4);
    expect(ctx.count('fill')).toBeGreaterThanOrEqual(1);
  });

  it('draws the image when the sprite is known', () => {
    const { canvas, ctx } = fakeCanvas();
    const image = {} as CanvasImageSource;
    const painter = createPainter(canvas, { devicePixelRatio: 1, reducedMotion: () => false, animate: false, sprite: (name) => (name === 'one' ? image : undefined) });
    painter.setScene(scene([{ kind: 'sprite', id: 'i-s', layer: 'actors', x: 3, y: 4, w: 20, h: 21, sprite: 'one' }]), 0);
    painter.paint(0);
    expect(ctx.calls.find((c) => c[0] === 'drawImage')).toEqual(['drawImage', image, 3, 4, 20, 21]);
  });

  it('writes the box list to data-scene after a paint', () => {
    const { canvas } = fakeCanvas();
    const painter = createPainter(canvas, { devicePixelRatio: 1, reducedMotion: () => false, animate: false, sprite: () => undefined });
    painter.setScene(scene([rect('i-a', 'world', 1, 2, '#111111', 3, 4)]), 0);
    painter.paint(0);
    expect(JSON.parse(canvas.dataset.scene ?? '[]')).toEqual([{ id: 'i-a', x: 1, y: 2, w: 3, h: 4 }]);
  });
});

describe('createPainter move animation', () => {
  const first = scene([rect('i-a', 'actors', 0, 0, '#a10001'), rect('i-b', 'actors', 50, 50, '#a10002')]);
  const second = scene([rect('i-a', 'actors', 40, 0, '#a10001'), rect('i-b', 'actors', 50, 50, '#a10002')]);
  const third = scene([rect('i-a', 'actors', 40, 20, '#a10001'), rect('i-b', 'actors', 50, 50, '#a10002')]);

  function xOf(ctx: RecordingContext, fill: string): number {
    const at = ctx.calls.findIndex((c) => c[0] === 'set:fillStyle' && c[1] === fill);
    const draw = ctx.calls.slice(at).find((c) => c[0] === 'fillRect' || c[0] === 'moveTo');
    return Number(draw?.[1]);
  }

  it('moves an item that keeps its id over 120 ms', () => {
    const { canvas, ctx } = fakeCanvas();
    const painter = createPainter(canvas, { devicePixelRatio: 1, reducedMotion: () => false, animate: true, sprite: () => undefined });
    painter.setScene(first, 1000);
    painter.setScene(second, 1000);
    expect(painter.isMoving(1000)).toBe(true);
    painter.paint(1060);
    const mid = xOf(ctx, '#a10001');
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(40);
    ctx.calls.length = 0;
    painter.paint(1120);
    expect(painter.isMoving(1120)).toBe(false);
    expect(xOf(ctx, '#a10001')).toBe(40);
  });

  it('does not move an item that stays in place', () => {
    const { canvas, ctx } = fakeCanvas();
    const painter = createPainter(canvas, { devicePixelRatio: 1, reducedMotion: () => false, animate: true, sprite: () => undefined });
    painter.setScene(first, 0);
    painter.setScene(second, 0);
    painter.paint(60);
    expect(xOf(ctx, '#a10002')).toBe(50);
  });

  it('ends a running move at once when a new action arrives', () => {
    const { canvas, ctx } = fakeCanvas();
    const painter = createPainter(canvas, { devicePixelRatio: 1, reducedMotion: () => false, animate: true, sprite: () => undefined });
    painter.setScene(first, 0);
    painter.setScene(second, 0);
    painter.setScene(third, 60);
    // The new move starts from the finished place of the old one, x 40, and not from x 20.
    painter.paint(60);
    expect(xOf(ctx, '#a10001')).toBe(40);
  });

  it('does not animate when animate is off', () => {
    const { canvas, ctx } = fakeCanvas();
    const painter = createPainter(canvas, { devicePixelRatio: 1, reducedMotion: () => false, animate: false, sprite: () => undefined });
    painter.setScene(first, 0);
    painter.setScene(second, 0);
    expect(painter.isMoving(0)).toBe(false);
    painter.paint(0);
    expect(xOf(ctx, '#a10001')).toBe(40);
  });
});

describe('createPainter effects', () => {
  const base = scene([rect('i-a', 'world', 0, 0)]);

  it('shakes the canvas 8 px for 240 ms', () => {
    const { canvas, ctx } = fakeCanvas();
    const painter = createPainter(canvas, { devicePixelRatio: 1, reducedMotion: () => false, animate: false, sprite: () => undefined });
    painter.setScene(base, 0);
    painter.shake(0);
    expect(painter.isShaking(100)).toBe(true);
    expect(painter.isShaking(240)).toBe(false);
    let biggest = 0;
    for (let t = 0; t < 240; t += 4) {
      ctx.calls.length = 0;
      painter.paint(t);
      const moved = ctx.calls.find((c) => c[0] === 'translate');
      if (moved) biggest = Math.max(biggest, Math.abs(Number(moved[1])), Math.abs(Number(moved[2])));
    }
    expect(biggest).toBeGreaterThan(0);
    expect(biggest).toBeLessThanOrEqual(8);
    ctx.calls.length = 0;
    painter.paint(240);
    expect(ctx.count('translate')).toBe(0);
  });

  it('flashes for 120 ms', () => {
    const { canvas, ctx } = fakeCanvas();
    const painter = createPainter(canvas, { devicePixelRatio: 1, reducedMotion: () => false, animate: false, sprite: () => undefined });
    painter.setScene(base, 0);
    painter.flash(0);
    expect(painter.isFlashing(60)).toBe(true);
    expect(painter.isFlashing(120)).toBe(false);
    ctx.calls.length = 0;
    painter.paint(60);
    const during = ctx.count('fillRect');
    ctx.calls.length = 0;
    painter.paint(120);
    expect(during).toBeGreaterThan(ctx.count('fillRect'));
  });

  it('turns shake and flash off when reduced motion is on', () => {
    const { canvas, ctx } = fakeCanvas();
    const painter = createPainter(canvas, { devicePixelRatio: 1, reducedMotion: () => true, animate: false, sprite: () => undefined });
    painter.setScene(base, 0);
    painter.shake(0);
    painter.flash(0);
    expect(painter.isShaking(10)).toBe(false);
    expect(painter.isFlashing(10)).toBe(false);
    ctx.calls.length = 0;
    painter.paint(10);
    expect(ctx.count('translate')).toBe(0);
    const withReduced = ctx.count('fillRect');
    const { canvas: c2, ctx: ctx2 } = fakeCanvas();
    const plain = createPainter(c2, { devicePixelRatio: 1, reducedMotion: () => false, animate: false, sprite: () => undefined });
    plain.setScene(base, 0);
    plain.paint(10);
    expect(withReduced).toBe(ctx2.count('fillRect'));
  });
});

describe('hudTextBoxes', () => {
  const scene = (items: SceneItem[]): Scene => ({ width: 400, height: 300, items });
  it('boxes a centred hud text from one em above its baseline, 0.7 em a letter', () => {
    const boxes = hudTextBoxes(scene([{ kind: 'text', id: 'hud-a', layer: 'hud', x: 200, y: 36, text: 'Turn 0 of 6', size: 24, fill: '#ffffff', align: 'center' }]));
    const w = Math.ceil(11 * 24 * 0.7);
    expect(boxes).toEqual([{ id: 'hud-a', x: 200 - w / 2, y: 12, w, h: Math.ceil(24 * 1.3) }]);
  });
  it('skips text that is not on the hud layer and items that are not text', () => {
    const boxes = hudTextBoxes(
      scene([
        { kind: 'text', id: 'world-text', layer: 'world', x: 0, y: 20, text: 'x', size: 10, fill: '#fff', align: 'left' },
        { kind: 'rect', id: 'r', layer: 'hud', x: 0, y: 0, w: 5, h: 5, fill: '#fff' },
      ]),
    );
    expect(boxes).toEqual([]);
  });
});
