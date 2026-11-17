import type { Scene, SceneItem } from '@kit/core';
import { createEffectRandom, createParticles, drawGlow, easeInOut, easeOut, type EffectCtx, type EffectLayer, type Pose, type Slot } from '@kit/shell';

// The effects of the garden puzzle. They only draw: they read the scene before and the scene now, never
// the state, and the shell hands in the time. Their random numbers come from a generator of their own
// with a fixed seed.

const SEED = 0x1a7e;
const FLY_MS_PER_CELL = 180;
const FLAP_MS = 90;
const FLAP_TO = 0.6;
const BLOOM_MS = 250;
const PULSE_MS = 2600;
const MOTES = 12;
const FLOURISH_MOTES = 36;
const FLOURISH_RING_MS = 700;
const LIGHT = '#ffb627';
const CORE = '#fff3c4';
const MOTE_COLOURS = [CORE, LIGHT, '#ff8a1f'];

interface Flight { fromX: number; fromY: number; start: number; dur: number; cell: number }
interface Lit { x: number; y: number; w: number; h: number; since: number; phase: number }
interface Ring { x: number; y: number; r: number; start: number }

// A number from the digits of an id, so each item has its own phase.
function phaseOf(id: string): number {
  let sum = 0;
  for (const part of id.match(/\d+/g) ?? []) sum = sum * 3 + Number(part);
  return (sum % 97) * 1.37;
}

function sprite(item: SceneItem | undefined): string | null {
  return item && item.kind === 'sprite' ? item.sprite : null;
}

export function createGardenEffects(): EffectLayer {
  const random = createEffectRandom(SEED);
  const particles = createParticles();
  let flights = new Map<string, Flight>();
  let lights = new Map<string, Lit>();
  let ring: Ring | null = null;

  function offsetOf(id: string, now: number): { dx: number; dy: number; lift: number } {
    const f = flights.get(id);
    if (!f) return { dx: 0, dy: 0, lift: 0 };
    const t = (now - f.start) / f.dur;
    if (t >= 1) return { dx: 0, dy: 0, lift: 0 };
    const k = 1 - easeInOut(Math.max(0, t));
    return { dx: f.fromX * k, dy: f.fromY * k, lift: Math.sin(Math.PI * Math.max(0, t)) * f.cell * 0.1 };
  }

  function burst(x: number, y: number, cell: number, count: number, delay: number, kind: string, now: number): void {
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const speed = cell * (0.5 + random() * 1.3);
      particles.spawn({
        kind,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - cell * 0.5,
        gravity: -cell * 0.7,
        life: 700 + random() * 300,
        delay,
        size: cell * (0.035 + random() * 0.035),
        endSize: cell * 0.01,
        color: MOTE_COLOURS[Math.floor(random() * MOTE_COLOURS.length)] ?? CORE,
        shape: 'dot',
      }, now);
    }
  }

  function boardOf(scene: Scene): { left: number; top: number; right: number; bottom: number } | null {
    let box: { left: number; top: number; right: number; bottom: number } | null = null;
    for (const item of scene.items) {
      if (item.kind !== 'sprite') continue;
      const next = { left: item.x, top: item.y, right: item.x + item.w, bottom: item.y + item.h };
      box = box
        ? { left: Math.min(box.left, next.left), top: Math.min(box.top, next.top), right: Math.max(box.right, next.right), bottom: Math.max(box.bottom, next.bottom) }
        : next;
    }
    return box;
  }

  function moths(scene: Scene): Extract<SceneItem, { kind: 'sprite' }>[] {
    return scene.items.filter((i): i is Extract<SceneItem, { kind: 'sprite' }> => i.kind === 'sprite' && i.id.startsWith('moth-'));
  }

  return {
    hold: { won: 1100, lost: 420 },

    change(prev, next, now) {
      const before = new Map((prev?.items ?? []).map((i) => [i.id, i]));
      const flying = new Map(flights);
      flights = new Map();
      let longest = 0;
      let cell = 0;
      for (const moth of moths(next)) {
        cell = moth.w;
        const was = before.get(moth.id);
        if (!was || was.kind !== 'sprite') continue;
        const here = { dx: 0, dy: 0 };
        const old = flying.get(moth.id);
        if (old) {
          const t = (now - old.start) / old.dur;
          if (t < 1) {
            const k = 1 - easeInOut(Math.max(0, t));
            here.dx = old.fromX * k;
            here.dy = old.fromY * k;
          }
        }
        const fromX = was.x - moth.x + here.dx;
        const fromY = was.y - moth.y + here.dy;
        if (was.x !== moth.x || was.y !== moth.y) {
          const cells = Math.max(1, Math.round((Math.abs(was.x - moth.x) + Math.abs(was.y - moth.y)) / Math.max(1, moth.w)));
          const dur = cells * FLY_MS_PER_CELL;
          flights.set(moth.id, { fromX, fromY, start: now, dur, cell: moth.w });
          longest = Math.max(longest, dur);
        } else if (old && now - old.start < old.dur) {
          flights.set(moth.id, { ...old, fromX: here.dx, fromY: here.dy, start: now, dur: Math.max(1, old.dur - (now - old.start)) });
        }
        if (sprite(was) !== 'moth_home' && moth.sprite === 'moth_home') {
          const delay = flights.get(moth.id)?.dur ?? 0;
          burst(moth.x + moth.w / 2, moth.y + moth.h / 2, moth.w, MOTES, delay, 'mote', now);
        }
      }

      // Lanterns: a lantern that is lit now and was not lit before blooms. One that was lit at the start stays lit.
      const nextLights = new Map<string, Lit>();
      for (const item of next.items) {
        if (item.kind !== 'sprite' || !item.id.startsWith('lantern-') || item.sprite !== 'lantern_lit') continue;
        const old = lights.get(item.id);
        nextLights.set(item.id, { x: item.x, y: item.y, w: item.w, h: item.h, since: old ? old.since : prev === null ? now - 100000 : now, phase: phaseOf(item.id) });
      }
      lights = nextLights;

      // The win: every moth is home now and was not before.
      const now2 = moths(next);
      const wasHome = prev !== null && moths(prev).length > 0 && moths(prev).every((m) => m.sprite === 'moth_home');
      if (prev !== null && now2.length > 0 && now2.every((m) => m.sprite === 'moth_home') && !wasHome) {
        const board = boardOf(next);
        if (board) {
          const delay = longest;
          const unit = Math.max(1, cell);
          for (let i = 0; i < FLOURISH_MOTES; i++) {
            particles.spawn({
              kind: 'flourish',
              x: board.left + random() * (board.right - board.left),
              y: board.bottom - random() * unit * 0.5,
              vx: (random() - 0.5) * unit * 0.6,
              vy: -unit * (1.2 + random() * 1.6),
              gravity: -unit * 0.2,
              life: 800 + random() * 300,
              delay: delay + random() * 200,
              size: unit * (0.04 + random() * 0.04),
              endSize: unit * 0.01,
              color: MOTE_COLOURS[Math.floor(random() * MOTE_COLOURS.length)] ?? CORE,
              shape: 'dot',
            }, now);
          }
          ring = { x: (board.left + board.right) / 2, y: (board.top + board.bottom) / 2, r: Math.max(board.right - board.left, board.bottom - board.top) * 0.6, start: now + delay };
        }
      }
    },

    reset() {
      flights = new Map();
      lights = new Map();
      ring = null;
      particles.clear();
    },

    owns: (id) => id.startsWith('moth-'),

    pose(item, now): Pose | null {
      if (item.kind !== 'sprite') return null;
      if (item.id.startsWith('moth-')) {
        const { dx, dy, lift } = offsetOf(item.id, now);
        const pose: Pose = { dx, dy: dy - lift };
        if (item.sprite === 'moth') {
          const phase = phaseOf(item.id) * 17;
          pose.sx = 1 - (1 - FLAP_TO) * (0.5 - 0.5 * Math.cos((2 * Math.PI * (now + phase)) / FLAP_MS));
        }
        return pose;
      }
      if (item.id.startsWith('web-')) {
        return { alpha: 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(now / 650 + phaseOf(item.id))) };
      }
      return null;
    },

    paint(ctx: EffectCtx, now: number, slot: Slot) {
      if (slot === 'world') {
        for (const lit of lights.values()) {
          const cx = lit.x + lit.w / 2;
          const cy = lit.y + lit.h * 0.42;
          const bloom = easeOut((now - lit.since) / BLOOM_MS);
          const pulse = 1 + 0.05 * Math.sin((2 * Math.PI * now) / PULSE_MS + lit.phase);
          const flicker = 1 + 0.05 * Math.sin(now / 53 + lit.phase) + 0.04 * Math.sin(now / 29 + lit.phase * 2);
          drawGlow(ctx, cx, cy, lit.w * 1.7 * bloom * pulse, LIGHT, 0.5 * (0.92 + 0.08 * Math.sin(now / 410 + lit.phase)));
          // The flame: a warm disc and a pale core, flickering.
          drawGlow(ctx, cx, cy, lit.w * 0.12 * bloom * flicker, CORE, 0.9, 3);
        }
      }
      if (slot === 'fx') {
        if (ring) {
          const t = (now - ring.start) / FLOURISH_RING_MS;
          if (t >= 1) ring = null;
          else if (t >= 0) drawGlow(ctx, ring.x, ring.y, ring.r * easeOut(t), '#ffe9a8', 0.4 * (1 - t));
        }
        particles.draw(ctx, now);
      }
    },

    counts: (now) => particles.counts(now),
  };
}
