import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSession, type Scene, type SceneItem } from '@kit/core';
import type { EffectCtx, EffectLayer } from '@kit/shell';
import { describe, expect, it } from 'vitest';
import def from '../def';
import { createGardenEffects } from './effects';

const viewport = { width: 960, height: 540, safe: { top: 0, right: 0, bottom: 0, left: 0 } };

// The scene at the start and after each action of the winning replay of g01.
function scenes(level: string, actions: string[]): Scene[] {
  const session = createSession(def, level, 1);
  const out = [def.view(session.state, viewport)];
  for (const action of actions) {
    session.apply(action);
    out.push(def.view(session.state, viewport));
  }
  return out;
}

const g01 = scenes('g01', ['light:1', 'wait']);

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

type Call = [string, ...unknown[]];
function recorder(): { ctx: EffectCtx; calls: Call[] } {
  const calls: Call[] = [];
  const store: Record<string, unknown> = {};
  const ctx = new Proxy(store, {
    get: (target, key: string) => (key in target ? target[key] : (...args: unknown[]) => void calls.push([key, ...args])),
    set: (target, key: string, value) => {
      target[key] = value;
      calls.push([`set:${key}`, value]);
      return true;
    },
  }) as unknown as EffectCtx;
  return { ctx, calls };
}

const item = (scene: Scene, id: string): SceneItem => {
  const found = scene.items.find((i) => i.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};
const mothHomeIndex = g01.findIndex((s) => s.items.some((i) => i.kind === 'sprite' && i.sprite === 'moth_home'));
const mothMovedIndex = g01.findIndex((s, i) => i > 0 && item(s, 'moth-1').kind === 'sprite' && (item(s, 'moth-1') as { x: number; y: number }).x + (item(s, 'moth-1') as { x: number; y: number }).y !== (item(g01[i - 1] as Scene, 'moth-1') as { x: number; y: number }).x + (item(g01[i - 1] as Scene, 'moth-1') as { x: number; y: number }).y);

function glowRadius(layer: EffectLayer, now: number): number {
  const { ctx, calls } = recorder();
  layer.paint(ctx, now, 'world');
  return Math.max(0, ...calls.filter((c) => c[0] === 'arc').map((c) => c[3] as number));
}

describe('the garden effects use the scenes the way the tests need', () => {
  it('has a scene where a moth moves and one where it is home', () => {
    expect(mothMovedIndex).toBeGreaterThan(0);
    expect(mothHomeIndex).toBeGreaterThan(0);
  });
});

describe('moths', () => {
  it('flap by scaling across to 0.6 and back every 90 ms', () => {
    const fx = createGardenEffects();
    fx.change(null, g01[0] as Scene, 0);
    const moth = item(g01[0] as Scene, 'moth-1');
    const sx = (now: number) => fx.pose(moth, now)?.sx ?? 1;
    const samples = Array.from({ length: 90 }, (_, i) => sx(i));
    expect(Math.min(...samples)).toBeCloseTo(0.6, 1);
    expect(Math.max(...samples)).toBeCloseTo(1, 1);
    expect(sx(10)).toBeCloseTo(sx(100), 6);
  });

  it('do not flap once home', () => {
    const fx = createGardenEffects();
    const last = g01[g01.length - 1] as Scene;
    fx.change(null, last, 0);
    expect(fx.pose(item(last, 'moth-1'), 20)?.sx ?? 1).toBe(1);
  });

  it('own their place, and nothing else does', () => {
    const fx = createGardenEffects();
    expect(fx.owns('moth-1')).toBe(true);
    expect(fx.owns('lantern-1')).toBe(false);
    expect(fx.owns('hud-turn')).toBe(false);
  });

  it('flutter from the old cell to the new one in 180 ms a cell, easing in and out', () => {
    const prev = g01[mothMovedIndex - 1] as Scene;
    const next = g01[mothMovedIndex] as Scene;
    const from = item(prev, 'moth-1') as { x: number; y: number; w: number };
    const to = item(next, 'moth-1') as { x: number; y: number; w: number };
    const fx = createGardenEffects();
    fx.change(prev, next, 1000);
    const at = (now: number) => fx.pose(item(next, 'moth-1'), now);
    const start = at(1000);
    expect(start?.dx).toBeCloseTo(from.x - to.x, 6);
    const mid = at(1090);
    expect(mid?.dx).toBeCloseTo((from.x - to.x) / 2, 6);
    expect(Math.abs(at(1045)?.dx ?? 0)).toBeGreaterThan(Math.abs((from.x - to.x) / 2) * 0.5 - 1e-9);
    const end = at(1180);
    expect(end?.dx ?? 0).toBeCloseTo(0, 6);
    expect(end?.dy ?? 0).toBeCloseTo(0, 6);
    // A step of one cell takes 180 ms and no more.
    expect(Math.abs(from.x - to.x) + Math.abs(from.y - to.y)).toBeCloseTo(to.w, 6);
  });

  it('are drawn at the place of the rules in the scene, which the pose never edits', () => {
    const frozen = g01.map((s) => deepFreeze(structuredClone(s)));
    const fx = createGardenEffects();
    fx.change(null, frozen[0] as Scene, 0);
    for (let i = 1; i < frozen.length; i++) fx.change(frozen[i - 1] as Scene, frozen[i] as Scene, i * 100);
    for (const s of frozen) for (const it of s.items) fx.pose(it, 500);
    fx.paint(recorder().ctx, 500, 'world');
    expect(frozen).toEqual(g01);
  });
});

describe('lanterns', () => {
  const lit = g01[1] as Scene;
  it('draw no light while unlit', () => {
    const fx = createGardenEffects();
    fx.change(null, g01[0] as Scene, 0);
    expect(glowRadius(fx, 100)).toBe(0);
  });

  it('bloom for 250 ms, then pulse slowly', () => {
    const fx = createGardenEffects();
    fx.change(g01[0] as Scene, lit, 1000);
    const r0 = glowRadius(fx, 1010);
    const r1 = glowRadius(fx, 1125);
    const r2 = glowRadius(fx, 1250);
    expect(r0).toBeGreaterThan(0);
    expect(r1).toBeGreaterThan(r0);
    expect(r2).toBeGreaterThan(r1);
    const later = Array.from({ length: 40 }, (_, i) => glowRadius(fx, 3000 + i * 100));
    expect(Math.max(...later) - Math.min(...later)).toBeGreaterThan(0.5);
    expect(Math.min(...later)).toBeGreaterThan(r2 * 0.85);
  });

  it('flicker a small flame, which differs from one moment to the next', () => {
    const fx = createGardenEffects();
    fx.change(g01[0] as Scene, lit, 0);
    const sizes = new Set<number>();
    for (let t = 2000; t < 2400; t += 17) {
      const { ctx, calls } = recorder();
      fx.paint(ctx, t, 'world');
      // The flame is the small disc. The light is the large discs.
      for (const c of calls) if (c[0] === 'arc' && (c[3] as number) < 20) sizes.add(Math.round((c[3] as number) * 1000));
    }
    expect(sizes.size).toBeGreaterThan(3);
  });
});

describe('webs', () => {
  const webScene = scenes('g01', [])[0] as Scene;
  const webs = scenes('g12', [])[0]?.items.filter((i) => i.id.startsWith('web-')) ?? [];
  it('shimmer, each with its own phase', () => {
    expect(webs.length).toBeGreaterThanOrEqual(1);
    const fx = createGardenEffects();
    const alphas = Array.from({ length: 200 }, (_, i) => fx.pose(webs[0] as SceneItem, i * 25)?.alpha ?? 1);
    expect(Math.max(...alphas)).toBeGreaterThan(Math.min(...alphas) + 0.1);
    expect(Math.min(...alphas)).toBeGreaterThanOrEqual(0.5);
    expect(Math.max(...alphas)).toBeLessThanOrEqual(1);
    if (webs.length > 1) {
      const a = fx.pose(webs[0] as SceneItem, 300)?.alpha;
      const b = fx.pose(webs[1] as SceneItem, 300)?.alpha;
      expect(a).not.toBe(b);
    }
    expect(webScene.items.length).toBeGreaterThan(0);
  });
});

describe('motes and the win', () => {
  it('burst when a moth reaches a flower, once its flight is over', () => {
    const fx = createGardenEffects();
    const prev = g01[mothHomeIndex - 1] as Scene;
    const next = g01[mothHomeIndex] as Scene;
    fx.change(prev, next, 0);
    const total = (now: number) => Object.values(fx.counts(now)).reduce((a, b) => a + b, 0);
    expect(total(0)).toBeGreaterThanOrEqual(8);
    expect(fx.counts(0).mote).toBeGreaterThanOrEqual(8);
    expect(total(5000)).toBe(0);
  });

  it('start from the cell of the flower', () => {
    const fx = createGardenEffects();
    const prev = g01[mothHomeIndex - 1] as Scene;
    const next = g01[mothHomeIndex] as Scene;
    fx.change(prev, next, 0);
    const moth = item(next, 'moth-1') as { x: number; y: number; w: number; h: number };
    const { ctx, calls } = recorder();
    fx.paint(ctx, 400, 'fx');
    const arcs = calls.filter((c) => c[0] === 'arc');
    expect(arcs.length).toBeGreaterThan(0);
    for (const a of arcs) {
      expect(Math.abs((a[1] as number) - (moth.x + moth.w / 2))).toBeLessThan(moth.w * 6);
      expect(Math.abs((a[2] as number) - (moth.y + moth.h / 2))).toBeLessThan(moth.w * 6);
    }
  });

  it('are not made for a moth that is caught or for a scene that only starts', () => {
    const fx = createGardenEffects();
    fx.change(null, g01[0] as Scene, 0);
    expect(fx.counts(0)).toEqual({});
    const caught = structuredClone(g01[0] as Scene);
    caught.items = caught.items.map((i) => (i.id === 'moth-1' && i.kind === 'sprite' ? { ...i, sprite: 'moth_caught' } : i));
    fx.change(g01[0] as Scene, caught, 10);
    expect(fx.counts(10).mote ?? 0).toBe(0);
  });

  it('end in a short win flourish when every moth is home', () => {
    const fx = createGardenEffects();
    const last = g01.length - 1;
    for (let i = 1; i <= last; i++) fx.change(g01[i - 1] as Scene, g01[i] as Scene, 0);
    expect(fx.counts(0).flourish).toBeGreaterThan(0);
    expect(fx.counts(1500).flourish ?? 0).toBe(0);
    const { ctx, calls } = recorder();
    fx.paint(ctx, 400, 'fx');
    expect(calls.filter((c) => c[0] === 'arc').length).toBeGreaterThan(0);
  });

  it('say how long the screen stays for a win and a loss', () => {
    const fx = createGardenEffects();
    expect(fx.hold?.won).toBeGreaterThanOrEqual(700);
    expect(fx.hold?.won).toBeLessThanOrEqual(2500);
    expect(fx.hold?.lost).toBeGreaterThan(0);
  });

  it('keep at most 200 particles however fast the scenes come', () => {
    const fx = createGardenEffects();
    for (let i = 0; i < 100; i++) {
      fx.change(g01[mothHomeIndex - 1] as Scene, g01[mothHomeIndex] as Scene, i);
      fx.change(g01[0] as Scene, g01[g01.length - 1] as Scene, i);
    }
    expect(Object.values(fx.counts(100)).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(200);
  });

  it('start over after a reset', () => {
    const fx = createGardenEffects();
    fx.change(g01[mothHomeIndex - 1] as Scene, g01[mothHomeIndex] as Scene, 0);
    fx.reset();
    expect(fx.counts(0)).toEqual({});
    expect(glowRadius(fx, 100)).toBe(0);
  });

  it('draw the same picture twice for the same scenes, because their random numbers are seeded', () => {
    const run = () => {
      const fx = createGardenEffects();
      fx.change(g01[mothHomeIndex - 1] as Scene, g01[mothHomeIndex] as Scene, 0);
      const { ctx, calls } = recorder();
      fx.paint(ctx, 300, 'fx');
      return calls;
    };
    expect(run()).toEqual(run());
  });
});

describe('the hard line: effects are drawing only', () => {
  const here = fileURLToPath(new URL('./', import.meta.url));
  const src = fileURLToPath(new URL('../', import.meta.url));

  it('read no clock and no Math.random, and use the seeded generator of the kit', () => {
    const text = readFileSync(`${here}effects.ts`, 'utf8');
    expect(text).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now|setTimeout|requestAnimationFrame/);
    expect(text).toContain('createEffectRandom');
  });

  it('are imported by no rule, no state, no level and no definition of the game', () => {
    const files = [...readdirSync(`${src}rules`).map((f) => `${src}rules/${f}`), `${src}def.ts`, `${src}input.ts`, `${src}proof.ts`, `${src}view/scene.ts`, ...readdirSync(`${src}levels`).map((f) => `${src}levels/${f}`)];
    for (const file of files.filter((f) => !f.endsWith('.test.ts'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from '[^']*effects'/);
    }
    const inner = [...readdirSync(`${src}rules`).map((f) => `${src}rules/${f}`), ...readdirSync(`${src}levels`).map((f) => `${src}levels/${f}`)];
    for (const file of inner.filter((f) => !f.endsWith('.test.ts'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/@kit\/shell/);
    }
  });
});
