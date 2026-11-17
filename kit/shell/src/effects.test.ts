import { describe, expect, it } from 'vitest';
import { clamp01, createEffectRandom, createParticles, drawGlow, easeInOut, easeOut, type EffectCtx } from './effects';

type Call = [string, ...unknown[]];

// A context that records every call and every property that is set.
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

const seed = { kind: 'dust', x: 10, y: 20, vx: 100, vy: -50, life: 1000, size: 4, color: '#aabbcc' };

describe('createEffectRandom', () => {
  it('gives the same numbers for the same seed and different numbers for another', () => {
    const a = createEffectRandom(7);
    const b = createEffectRandom(7);
    const c = createEffectRandom(8);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
  });

  it('stays from 0 up to but not including 1', () => {
    const next = createEffectRandom(1);
    for (let i = 0; i < 2000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('easing', () => {
  it('starts at 0 and ends at 1 and keeps its input in range', () => {
    for (const ease of [easeInOut, easeOut]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
      expect(ease(-3)).toBe(0);
      expect(ease(9)).toBe(1);
    }
    expect(clamp01(0.4)).toBe(0.4);
  });

  it('eases in and out: slow at both ends and 0.5 in the middle', () => {
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
  });
});

describe('createParticles', () => {
  it('counts a particle from the moment it is spawned until its life is over', () => {
    const p = createParticles(50);
    p.spawn(seed, 1000);
    expect(p.counts(1000)).toEqual({ dust: 1 });
    expect(p.total(1999)).toBe(1);
    expect(p.total(2000)).toBe(0);
  });

  it('counts a delayed particle, and draws it only after its delay', () => {
    const p = createParticles(50);
    p.spawn({ ...seed, delay: 200 }, 0);
    expect(p.total(0)).toBe(1);
    const early = recorder();
    p.draw(early.ctx, 100);
    expect(early.calls.filter((c) => c[0] === 'fill' || c[0] === 'fillRect')).toHaveLength(0);
    const later = recorder();
    p.draw(later.ctx, 300);
    expect(later.calls.filter((c) => c[0] === 'arc' || c[0] === 'fillRect').length).toBeGreaterThan(0);
  });

  it('never holds more than its cap and drops the oldest first', () => {
    const p = createParticles(5);
    for (let i = 0; i < 12; i++) p.spawn({ ...seed, kind: i < 7 ? 'old' : 'new' }, i);
    expect(p.total(20)).toBe(5);
    expect(p.counts(20)).toEqual({ new: 5 });
  });

  it('has a default cap of 200', () => {
    const p = createParticles();
    for (let i = 0; i < 500; i++) p.spawn(seed, 0);
    expect(p.total(0)).toBe(200);
  });

  it('moves a particle by its speed and its gravity, from its start', () => {
    const p = createParticles(5);
    p.spawn({ ...seed, shape: 'dot', gravity: 200 }, 0);
    const { ctx, calls } = recorder();
    p.draw(ctx, 500);
    const arc = calls.find((c) => c[0] === 'arc');
    // 0.5 s: x = 10 + 100 * 0.5, y = 20 - 50 * 0.5 + 0.5 * 200 * 0.25
    expect(arc?.[1]).toBeCloseTo(60, 6);
    expect(arc?.[2]).toBeCloseTo(20, 6);
  });

  it('fades a particle out and leaves the alpha at 1', () => {
    const p = createParticles(5);
    p.spawn(seed, 0);
    const { ctx, calls } = recorder();
    p.draw(ctx, 900);
    const alphas = calls.filter((c) => c[0] === 'set:globalAlpha').map((c) => c[1] as number);
    expect(alphas[0]).toBeLessThan(0.5);
    expect(alphas[alphas.length - 1]).toBe(1);
  });

  it('draws paper as a turned rectangle and a spark as a rectangle', () => {
    const p = createParticles(5);
    p.spawn({ ...seed, shape: 'paper', spin: 3 }, 0);
    p.spawn({ ...seed, shape: 'spark' }, 0);
    const { ctx, calls } = recorder();
    p.draw(ctx, 100);
    expect(calls.filter((c) => c[0] === 'rotate')).toHaveLength(2);
    expect(calls.filter((c) => c[0] === 'fillRect')).toHaveLength(2);
  });

  it('clears all particles', () => {
    const p = createParticles(5);
    p.spawn(seed, 0);
    p.clear();
    expect(p.total(0)).toBe(0);
  });
});

describe('drawGlow', () => {
  it('draws stacked discs around a point and leaves the alpha at 1', () => {
    const { ctx, calls } = recorder();
    drawGlow(ctx, 50, 60, 40, '#ffb627', 0.5);
    const arcs = calls.filter((c) => c[0] === 'arc');
    expect(arcs.length).toBeGreaterThanOrEqual(4);
    expect(arcs.every((c) => c[1] === 50 && c[2] === 60)).toBe(true);
    const radii = arcs.map((c) => c[3] as number);
    expect(Math.max(...radii)).toBeCloseTo(40, 6);
    expect(calls.filter((c) => c[0] === 'set:globalAlpha').pop()?.[1]).toBe(1);
  });

  it('draws nothing for a radius of 0 or an alpha of 0', () => {
    const { ctx, calls } = recorder();
    drawGlow(ctx, 0, 0, 0, '#ffffff', 1);
    drawGlow(ctx, 0, 0, 10, '#ffffff', 0);
    expect(calls.filter((c) => c[0] === 'arc')).toHaveLength(0);
  });
});
