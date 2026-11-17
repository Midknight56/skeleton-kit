import type { Scene, SceneItem } from '@kit/core';
import { createEffectRandom, createParticles, type EffectCtx, type EffectLayer, type Pose, type Slot } from '@kit/shell';

// The effects of the runner. They only draw: they read the scene before and the scene now, never the
// state, and the shell hands in the time. Their random numbers come from a generator of their own with
// a fixed seed. Every particle count is capped at 200 live particles.

type Sprite = Extract<SceneItem, { kind: 'sprite' }>;

const SEED = 0x5e17;
const MOON_SPEED = 0.2;
const FAR_SPEED = 0.5;
const NEAR_SPEED = 1;
const CLOUD_PARALLAX = 0.1;
const SPARKS = ['#ffb627', '#ff8a1f', '#fff3c4'];
const DUST = ['#8c7fb5', '#b5abcf', '#6b5aa0'];
const PAPER = ['#ff8a1f', '#ffb627', '#7c63d9', '#efe7d2'];

// Clouds: where each starts across the width, its height as a fraction of the sky, its size as a
// fraction of the width and its drift in px a second to the left.
const CLOUDS = [
  { start: 0.15, height: 0.18, size: 0.05, speed: 16 },
  { start: 0.55, height: 0.3, size: 0.07, speed: 11 },
  { start: 0.85, height: 0.12, size: 0.045, speed: 22 },
  { start: 0.35, height: 0.42, size: 0.06, speed: 14 },
];

function sprite(scene: Scene | null, id: string): Sprite | null {
  const found = scene?.items.find((i) => i.id === id);
  return found && found.kind === 'sprite' ? found : null;
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export function createRunnerEffects(): EffectLayer {
  const random = createEffectRandom(SEED);
  const particles = createParticles();
  // How far the course has moved past the rider, in px. It is 0 at the start.
  let scroll = 0;
  let width = 0;
  let skyHeight = 0;
  let moon: { y: number; h: number } | null = null;
  const cleared = new Set<string>();

  const spread = (min: number, max: number): number => min + random() * (max - min);
  const pick = (list: string[]): string => list[Math.floor(random() * list.length)] ?? '#ffffff';

  function dust(x: number, y: number, unit: number, count: number, now: number): void {
    for (let i = 0; i < count; i++) {
      particles.spawn(
        {
          kind: 'dust',
          x: x + spread(-0.2, 0.2) * unit,
          y,
          vx: -unit * spread(1.5, 5),
          vy: -unit * spread(0.2, 1.2),
          gravity: unit * 0.8,
          life: spread(350, 600),
          size: unit * spread(0.1, 0.18),
          endSize: unit * 0.3,
          color: pick(DUST),
          alpha: 0.7,
        },
        now,
      );
    }
  }

  function sparks(x: number, y: number, unit: number, count: number, now: number, kind = 'spark', fast = 1): void {
    for (let i = 0; i < count; i++) {
      particles.spawn(
        {
          kind,
          x,
          y: y + spread(-0.04, 0.04) * unit,
          vx: -unit * spread(4, 8) * fast,
          vy: unit * spread(-0.8, 0.8) * fast,
          gravity: unit * 1.5,
          life: spread(300, 450),
          size: unit * spread(0.025, 0.05),
          endSize: unit * 0.01,
          color: pick(SPARKS),
          shape: 'spark',
          turn: 0,
          spin: 0,
        },
        now,
      );
    }
  }

  function paper(x: number, y: number, unit: number, count: number, now: number, kind: string): void {
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const speed = unit * spread(1.5, 5);
      particles.spawn(
        {
          kind,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - unit * 2,
          gravity: unit * 9,
          life: spread(600, 950),
          size: unit * spread(0.09, 0.16),
          color: pick(PAPER),
          shape: 'paper',
          turn: random() * Math.PI,
          spin: spread(-9, 9),
        },
        now,
      );
    }
  }

  function groundOf(scene: Scene): number {
    return sprite(scene, 'back-sky')?.h ?? 0;
  }

  function airborne(item: Sprite, ground: number): boolean {
    return item.y + item.h < ground - 1;
  }

  function landed(item: Sprite, ground: number): boolean {
    return Math.abs(item.y + item.h - ground) < 1;
  }

  return {
    change(prev, next, now) {
      width = next.width;
      const sky = sprite(next, 'back-sky');
      skyHeight = sky?.h ?? skyHeight;
      const moonItem = sprite(next, 'back-moon');
      if (moonItem) moon = { y: moonItem.y, h: moonItem.h };
      const rider = sprite(next, 'player');
      if (!rider) return;

      // The distance of the course past the rider, from any ground piece that is in view.
      const piece = next.items.find((i): i is Sprite => i.kind === 'sprite' && i.id.startsWith('ground-'));
      if (piece) {
        const column = Number(piece.id.slice('ground-'.length));
        scroll = column * piece.w - piece.x + rider.x;
      }

      if (prev === null) {
        cleared.clear();
        return;
      }
      const before = sprite(prev, 'player');
      const unit = rider.w;
      const ground = groundOf(next);
      const alive = rider.sprite === 'broom';

      if (alive) {
        // The trail: a spark from the bristles on each tick.
        sparks(rider.x + rider.w * 0.04, rider.y + rider.h * 0.78, unit, 1, now);
      }
      if (before && alive && before.sprite === 'broom') {
        if (landed(before, ground) && airborne(rider, ground)) {
          dust(rider.x + rider.w * 0.4, ground, unit, 8, now);
          sparks(rider.x + rider.w * 0.04, rider.y + rider.h * 0.78, unit, 8, now, 'spark', 1.4);
        } else if (airborne(before, ground) && landed(rider, ground)) {
          dust(rider.x + rider.w * 0.5, ground, unit, 10, now);
        }
      }
      if (before && before.sprite === 'broom' && rider.sprite === 'broom_down') {
        paper(rider.x + rider.w / 2, rider.y + rider.h / 2, unit, 16, now, 'crash');
        sparks(rider.x + rider.w / 2, rider.y + rider.h / 2, unit, 10, now, 'crash', 2);
      }

      // A pumpkin the rider passes over bursts into paper.
      const centre = rider.x + rider.w / 2;
      for (const item of next.items) {
        if (item.kind !== 'sprite' || !item.id.startsWith('pumpkin-')) continue;
        const was = sprite(prev, item.id);
        const cx = item.x + item.w / 2;
        if (cx > centre) cleared.delete(item.id);
        if (!was || !alive || cleared.has(item.id)) continue;
        if (was.x + was.w / 2 > centre && cx <= centre) {
          cleared.add(item.id);
          paper(cx, item.y + item.h / 2, item.w, 14, now, 'paper');
        }
      }
    },

    reset() {
      particles.clear();
      cleared.clear();
      scroll = 0;
    },

    owns: () => false,

    pose(item, now): Pose | null {
      if (item.kind !== 'sprite') return null;
      if (item.id === 'back-moon') {
        // The moon moves at a fifth of the speed of the ground, and comes in again from the right.
        const span = width + 2 * item.w;
        const x = mod(item.x - MOON_SPEED * scroll + item.w, span) - item.w;
        return { dx: x - item.x };
      }
      if (item.id === 'back-hills-far') return { dx: -FAR_SPEED * scroll, wrap: item.w };
      if (item.id === 'back-hills-near') return { dx: -NEAR_SPEED * scroll, wrap: item.w };
      if (item.id.startsWith('back-star-')) {
        const n = Number(item.id.slice('back-star-'.length));
        return { alpha: 0.55 + 0.45 * Math.sin(now / (420 + n * 97) + n * 1.9) };
      }
      if (cleared.has(item.id)) return { alpha: 0 };
      return null;
    },

    paint(ctx: EffectCtx, now: number, slot: Slot) {
      if (slot === 'back' && width > 0 && skyHeight > 0) {
        ctx.fillStyle = '#3a2f66';
        ctx.globalAlpha = 0.55;
        CLOUDS.forEach((cloud, i) => {
          const r = width * cloud.size;
          const span = width + 6 * r;
          const x = mod(width * cloud.start - cloud.speed * (now / 1000) - CLOUD_PARALLAX * scroll + 3 * r, span) - 3 * r;
          // The last cloud drifts at the height of the moon face, so it passes in front of the moon.
          const onMoon = moon !== null && i === CLOUDS.length - 1;
          const y = onMoon && moon ? moon.y + moon.h / 2 : skyHeight * cloud.height;
          for (const [dx, dy, k] of [[0, 0, 1], [r * 0.9, -r * 0.25, 0.8], [r * 1.7, 0.05 * r, 0.7], [r * 0.8, r * 0.2, 0.75]] as [number, number, number][]) {
            ctx.beginPath();
            ctx.arc(x + dx, y + dy, r * k, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        ctx.globalAlpha = 1;
      }
      if (slot === 'fx') particles.draw(ctx, now);
    },

    counts: (now) => particles.counts(now),
  };
}
