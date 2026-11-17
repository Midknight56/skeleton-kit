import type { Layer, Scene, SceneItem } from '@kit/core';
import type { Ctx2D } from './painter';

// Effects are drawing only. A game gives the shell an effect layer. The painter calls it with the scene
// before and the scene now, asks it how to pose each item, and lets it draw around the items. The layer
// never changes the scene, the state or the rules, and it keeps its own seeded random numbers.

// 'start' is before the first layer. A layer name is after the items of that layer.
export type Slot = 'start' | Layer;

// How an item is drawn, measured from the place the scene gives it. The box in the scene does not change.
export interface Pose {
  dx?: number;
  dy?: number;
  // Scale across and down, about the centre of the item.
  sx?: number;
  sy?: number;
  // Turn in radians, about the centre of the item.
  turn?: number;
  // Multiplies the opacity of the item.
  alpha?: number;
  // The item is a strip as wide as this. It is drawn again, mirrored, on each side, and `dx` runs round.
  wrap?: number;
}

export interface EffectCtx extends Ctx2D {
  rotate(angle: number): void;
}

export interface EffectLayer {
  // The scene before (null at the start or after a reset) and the scene now.
  change(prev: Scene | null, next: Scene, now: number): void;
  reset(): void;
  // True when the layer places this item itself, so the painter does not glide it.
  owns(id: string): boolean;
  pose(item: SceneItem, now: number): Pose | null;
  paint(ctx: EffectCtx, now: number, slot: Slot): void;
  // Queued and live particles by kind. The painter publishes the sum for tests.
  counts(now: number): Record<string, number>;
  // How long to keep the play screen before the results screen, in ms.
  hold?: { won: number; lost: number };
}

export type EffectFactory = () => EffectLayer;

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function easeInOut(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function easeOut(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) * (1 - x);
}

// mulberry32, a float from 0 up to but not including 1. It is for effects only.
export function createEffectRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ParticleShape = 'dot' | 'spark' | 'paper';

export interface ParticleSeed {
  kind: string;
  x: number;
  y: number;
  // px a second, and px a second squared for gravity.
  vx: number;
  vy: number;
  gravity?: number;
  // ms.
  life: number;
  delay?: number;
  size: number;
  endSize?: number;
  color: string;
  shape?: ParticleShape;
  // Start angle and turn in radians a second, for paper and spark.
  turn?: number;
  spin?: number;
  alpha?: number;
}

interface Particle extends ParticleSeed { born: number }

export interface Particles {
  spawn(seed: ParticleSeed, now: number): void;
  counts(now: number): Record<string, number>;
  total(now: number): number;
  draw(ctx: EffectCtx, now: number): void;
  clear(): void;
}

export const DEFAULT_PARTICLE_CAP = 200;

export function createParticles(cap = DEFAULT_PARTICLE_CAP): Particles {
  let list: Particle[] = [];

  const alive = (p: Particle, now: number): boolean => now < p.born + p.life;
  const prune = (now: number): void => {
    if (list.some((p) => !alive(p, now))) list = list.filter((p) => alive(p, now));
  };

  return {
    spawn(seed, now) {
      list.push({ ...seed, born: now + (seed.delay ?? 0) });
      if (list.length > cap) list.splice(0, list.length - cap);
    },
    counts(now) {
      prune(now);
      const out: Record<string, number> = {};
      for (const p of list) out[p.kind] = (out[p.kind] ?? 0) + 1;
      return out;
    },
    total(now) {
      prune(now);
      return list.length;
    },
    draw(ctx, now) {
      prune(now);
      for (const p of list) {
        if (now < p.born) continue;
        const age = (now - p.born) / 1000;
        const f = (now - p.born) / p.life;
        const x = p.x + p.vx * age;
        const y = p.y + p.vy * age + 0.5 * (p.gravity ?? 0) * age * age;
        const size = p.size + ((p.endSize ?? p.size) - p.size) * f;
        ctx.globalAlpha = (p.alpha ?? 1) * (f < 0.3 ? 1 : (1 - f) / 0.7);
        ctx.fillStyle = p.color;
        const shape = p.shape ?? 'dot';
        if (shape === 'dot') {
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.1, size), 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        const w = shape === 'spark' ? size * 2.4 : size;
        const h = shape === 'spark' ? size * 0.7 : size * 0.6;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((p.turn ?? 0) + (p.spin ?? 0) * age);
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      list = [];
    },
  };
}

// A soft light: discs from the full radius down to a small one, each faint, so the middle is brightest.
export function drawGlow(ctx: Ctx2D, x: number, y: number, radius: number, color: string, alpha: number, steps = 8): void {
  if (radius <= 0 || alpha <= 0) return;
  ctx.fillStyle = color;
  ctx.globalAlpha = Math.min(1, (alpha * 1.8) / steps);
  for (let i = steps; i >= 1; i--) {
    ctx.beginPath();
    ctx.arc(x, y, (radius * i) / steps, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
