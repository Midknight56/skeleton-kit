import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSession, expandActions, type Scene, type SceneItem } from '@kit/core';
import type { EffectCtx, EffectLayer } from '@kit/shell';
import { describe, expect, it } from 'vitest';
import def from '../def';
import { createRunnerEffects } from './effects';

const viewport = { width: 960, height: 540, safe: { top: 0, right: 0, bottom: 0, left: 0 } };

const proof = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../proofs/runner/r01.json', import.meta.url)), 'utf8')) as { replay: { actions: string[] } };
const expanded = expandActions(proof.replay.actions);
if (!expanded.ok) throw new Error(expanded.message);
const ACTIONS = expanded.actions;
const FIRST_JUMP = ACTIONS.indexOf('jump');

// The scene at the start, and after each of the first `count` ticks of the proof replay of r01.
function run(count: number): Scene[] {
  const session = createSession(def, 'r01', 1);
  const out = [def.view(session.state, viewport)];
  for (let i = 0; i < count; i++) {
    session.apply(ACTIONS[i] as string);
    out.push(def.view(session.state, viewport));
  }
  return out;
}

const r01 = run(FIRST_JUMP + 120);

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

type Sprite = Extract<SceneItem, { kind: 'sprite' }>;
const sprite = (scene: Scene, id: string): Sprite => {
  const found = scene.items.find((i) => i.id === id);
  if (!found || found.kind !== 'sprite') throw new Error(`no sprite ${id}`);
  return found;
};
const player = (scene: Scene): Sprite => sprite(scene, 'player');
const groundY = (scene: Scene): number => sprite(scene, 'back-sky').h;
const grounded = (scene: Scene): boolean => Math.abs(player(scene).y + player(scene).h - groundY(scene)) < 1;
const total = (fx: EffectLayer, now: number): number => Object.values(fx.counts(now)).reduce((a, b) => a + b, 0);

function feed(fx: EffectLayer, scenes: Scene[], from: number, to: number, dt = 16): number {
  let now = from * dt;
  for (let i = Math.max(1, from); i <= to; i++) {
    now = i * dt;
    fx.change(scenes[i - 1] as Scene, scenes[i] as Scene, now);
  }
  return now;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

// A hand made scene of a rider and one pumpkin, for the cases the first course does not have.
function pumpkinScene(pumpkinX: number, rider: 'broom' | 'broom_down' = 'broom'): Scene {
  return {
    width: 400,
    height: 300,
    items: [
      { kind: 'sprite', id: 'back-sky', layer: 'back', x: 0, y: 0, w: 400, h: 200, sprite: 'sky' },
      { kind: 'sprite', id: 'ground-0', layer: 'world', x: 0, y: 200, w: 40, h: 100, sprite: 'ground' },
      { kind: 'sprite', id: 'pumpkin-3', layer: 'world', x: pumpkinX, y: 160, w: 40, h: 40, sprite: 'pumpkin' },
      { kind: 'sprite', id: 'player', layer: 'actors', x: 100, y: 130, w: 40, h: 56, sprite: rider },
    ],
  };
}

describe('the spark trail', () => {
  it('leaves sparks behind the rider on every tick of a run', () => {
    const fx = createRunnerEffects();
    const now = feed(fx, r01, 1, 30);
    expect(fx.counts(now).spark).toBeGreaterThan(5);
  });

  it('stays small however long the run goes on', () => {
    const fx = createRunnerEffects();
    const now = feed(fx, r01, 1, FIRST_JUMP);
    expect(total(fx, now)).toBeLessThan(80);
  });

  it('leaves no sparks behind a rider who is down', () => {
    const fx = createRunnerEffects();
    fx.change(pumpkinScene(300, 'broom_down'), pumpkinScene(300, 'broom_down'), 100);
    expect(fx.counts(100).spark ?? 0).toBe(0);
  });

  it('draws the sparks as small rectangles in the fx slot', () => {
    const fx = createRunnerEffects();
    const now = feed(fx, r01, 1, 10);
    const { ctx, calls } = recorder();
    fx.paint(ctx, now, 'fx');
    expect(calls.filter((c) => c[0] === 'fillRect').length).toBeGreaterThan(0);
  });
});

describe('dust', () => {
  it('puffs at take off and again at landing', () => {
    const fx = createRunnerEffects();
    const tOff = FIRST_JUMP + 1;
    expect(grounded(r01[tOff - 1] as Scene)).toBe(true);
    expect(grounded(r01[tOff] as Scene)).toBe(false);
    feed(fx, r01, 1, tOff - 1);
    const before = fx.counts(tOff * 16).dust ?? 0;
    expect(before).toBe(0);
    feed(fx, r01, tOff, tOff);
    expect(fx.counts(tOff * 16).dust).toBeGreaterThanOrEqual(6);
    let landing = tOff + 1;
    while (landing < r01.length && !grounded(r01[landing] as Scene)) landing++;
    expect(landing).toBeLessThan(r01.length);
    const fx2 = createRunnerEffects();
    // Start the layer far enough after the take off that its puff is gone by the landing.
    fx2.change(r01[landing - 1] as Scene, r01[landing] as Scene, 60000);
    expect(fx2.counts(60000).dust).toBeGreaterThanOrEqual(6);
  });

  it('adds sparks at take off', () => {
    const tOff = FIRST_JUMP + 1;
    const calm = createRunnerEffects();
    calm.change(r01[tOff - 2] as Scene, r01[tOff - 1] as Scene, 0);
    const jump = createRunnerEffects();
    jump.change(r01[tOff - 1] as Scene, r01[tOff] as Scene, 0);
    expect(jump.counts(0).spark).toBeGreaterThan(calm.counts(0).spark ?? 0);
  });
});

describe('pumpkins and a crash', () => {
  it('bursts into paper where the rider passes over, and then is not drawn', () => {
    const fx = createRunnerEffects();
    const before = pumpkinScene(130);
    const after = pumpkinScene(90);
    fx.change(null, before, 0);
    expect(fx.pose(sprite(before, 'pumpkin-3'), 10)?.alpha ?? 1).toBe(1);
    fx.change(before, after, 16);
    expect(fx.counts(16).paper).toBeGreaterThanOrEqual(8);
    expect(fx.pose(sprite(after, 'pumpkin-3'), 20)?.alpha).toBe(0);
    expect(fx.pose(sprite(after, 'ground-0'), 20)?.alpha ?? 1).toBe(1);
  });

  it('draws the pieces as turned rectangles', () => {
    const fx = createRunnerEffects();
    fx.change(pumpkinScene(130), pumpkinScene(90), 0);
    const { ctx, calls } = recorder();
    fx.paint(ctx, 100, 'fx');
    expect(calls.filter((c) => c[0] === 'rotate').length).toBeGreaterThanOrEqual(8);
  });

  it('does not burst a pumpkin that the rider hit', () => {
    const fx = createRunnerEffects();
    fx.change(pumpkinScene(130), pumpkinScene(90, 'broom_down'), 0);
    expect(fx.counts(0).paper ?? 0).toBe(0);
    expect(fx.pose(sprite(pumpkinScene(90), 'pumpkin-3'), 10)?.alpha ?? 1).toBe(1);
  });

  it('bursts on a crash', () => {
    const fx = createRunnerEffects();
    fx.change(pumpkinScene(130), pumpkinScene(120, 'broom_down'), 0);
    expect(fx.counts(0).crash).toBeGreaterThanOrEqual(10);
  });

  it('shows a pumpkin again after a restart', () => {
    const fx = createRunnerEffects();
    fx.change(pumpkinScene(130), pumpkinScene(90), 0);
    fx.reset();
    fx.change(null, pumpkinScene(90), 5);
    expect(fx.pose(sprite(pumpkinScene(90), 'pumpkin-3'), 10)?.alpha ?? 1).toBe(1);
    expect(fx.counts(5)).toEqual({});
  });
});

describe('the night sky', () => {
  const scrollOf = (a: Scene, b: Scene): number => {
    const ids = a.items.filter((i) => i.id.startsWith('ground-')).map((i) => i.id);
    const id = ids.find((x) => b.items.some((i) => i.id === x));
    if (!id) throw new Error('no common ground');
    return sprite(a, id).x - sprite(b, id).x;
  };

  it('moves the moon at 0.2 and the near rooftops at 1 times the speed of the ground, the far ones between', () => {
    const fx = createRunnerEffects();
    fx.change(null, r01[0] as Scene, 0);
    const a = r01[0] as Scene;
    const b = r01[3] as Scene;
    const poseAt = (scene: Scene, id: string) => {
      fx.change(a, scene, 0);
      return fx.pose(sprite(scene, id), 0);
    };
    const scroll = scrollOf(a, b);
    expect(scroll).toBeGreaterThan(5);
    const moon0 = poseAt(a, 'back-moon')?.dx ?? 0;
    const moon1 = poseAt(b, 'back-moon')?.dx ?? 0;
    expect(moon0 - moon1).toBeCloseTo(0.2 * scroll, 4);
    const near0 = poseAt(a, 'back-hills-near');
    const near1 = poseAt(b, 'back-hills-near');
    expect((near0?.dx ?? 0) - (near1?.dx ?? 0)).toBeCloseTo(scroll, 4);
    expect(near1?.wrap).toBe(sprite(b, 'back-hills-near').w);
    const far0 = poseAt(a, 'back-hills-far');
    const far1 = poseAt(b, 'back-hills-far');
    const farSpeed = ((far0?.dx ?? 0) - (far1?.dx ?? 0)) / scroll;
    expect(farSpeed).toBeGreaterThan(0.2);
    expect(farSpeed).toBeLessThan(1);
  });

  it('keeps every picture of the sky where the scene puts it before the run starts', () => {
    const fx = createRunnerEffects();
    fx.change(null, r01[0] as Scene, 0);
    expect(fx.pose(sprite(r01[0] as Scene, 'back-moon'), 0)?.dx ?? 0).toBeCloseTo(0, 6);
    expect(fx.pose(sprite(r01[0] as Scene, 'back-hills-near'), 0)?.dx ?? 0).toBeCloseTo(0, 6);
  });

  it('twinkles the stars, each at its own pace', () => {
    const fx = createRunnerEffects();
    fx.change(null, r01[0] as Scene, 0);
    const star = (n: number, now: number) => fx.pose(sprite(r01[0] as Scene, `back-star-${n}`), now)?.alpha ?? 1;
    const series = Array.from({ length: 300 }, (_, i) => star(1, i * 20));
    expect(Math.max(...series) - Math.min(...series)).toBeGreaterThan(0.3);
    expect(Math.min(...series)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...series)).toBeLessThanOrEqual(1);
    expect(star(1, 300)).not.toBeCloseTo(star(2, 300), 3);
  });

  it('drifts clouds across the sky, past the moon, drawn behind the rider', () => {
    const fx = createRunnerEffects();
    fx.change(null, r01[0] as Scene, 0);
    const at = (now: number) => {
      const { ctx, calls } = recorder();
      fx.paint(ctx, now, 'back');
      return calls.filter((c) => c[0] === 'arc');
    };
    const a = at(0);
    const b = at(2000);
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(b.map((c) => c[1])).not.toEqual(a.map((c) => c[1]));
    const sky = groundY(r01[0] as Scene);
    for (const c of a) expect(c[2] as number).toBeLessThan(sky);
    const { ctx, calls } = recorder();
    fx.paint(ctx, 0, 'actors');
    expect(calls.filter((c) => c[0] === 'arc')).toHaveLength(0);
  });

  it('draws a cloud at the height of the moon face at some time', () => {
    const fx = createRunnerEffects();
    fx.change(null, r01[0] as Scene, 0);
    const moon = sprite(r01[0] as Scene, 'back-moon');
    let near = false;
    for (let now = 0; now < 120000 && !near; now += 500) {
      const { ctx, calls } = recorder();
      fx.paint(ctx, now, 'back');
      near = calls.some((c) => c[0] === 'arc' && Math.abs((c[2] as number) - (moon.y + moon.h / 2)) < moon.h * 0.4);
    }
    expect(near).toBe(true);
  });
});

describe('limits and the hard line', () => {
  it('keeps at most 200 live particles however fast the scenes come', () => {
    const fx = createRunnerEffects();
    for (let i = 0; i < 400; i++) {
      fx.change(r01[FIRST_JUMP] as Scene, r01[FIRST_JUMP + 1] as Scene, i);
      fx.change(pumpkinScene(130), pumpkinScene(90), i);
      fx.change(pumpkinScene(130), pumpkinScene(120, 'broom_down'), i);
    }
    expect(total(fx, 400)).toBeLessThanOrEqual(200);
  });

  it('never edits a scene', () => {
    const frozen = r01.map((s) => deepFreeze(structuredClone(s)));
    const fx = createRunnerEffects();
    fx.change(null, frozen[0] as Scene, 0);
    for (let i = 1; i < frozen.length; i++) fx.change(frozen[i - 1] as Scene, frozen[i] as Scene, i * 16);
    for (const it of (frozen[frozen.length - 1] as Scene).items) fx.pose(it, 900);
    const { ctx } = recorder();
    for (const slot of ['start', 'back', 'world', 'actors', 'fx', 'hud'] as const) fx.paint(ctx, 900, slot);
    expect(frozen).toEqual(r01);
  });

  it('draws the same picture twice for the same scenes, because its random numbers are seeded', () => {
    const once = () => {
      const fx = createRunnerEffects();
      const now = feed(fx, r01, 1, FIRST_JUMP + 20);
      const { ctx, calls } = recorder();
      fx.paint(ctx, now + 50, 'fx');
      return calls;
    };
    expect(once()).toEqual(once());
  });

  it('asks for no hold, so the shell keeps its own delay', () => {
    expect(createRunnerEffects().hold).toBeUndefined();
  });

  it('reads no clock and no Math.random, and is imported by no rule, state, level or definition', () => {
    const here = fileURLToPath(new URL('./', import.meta.url));
    const src = fileURLToPath(new URL('../', import.meta.url));
    const text = readFileSync(`${here}effects.ts`, 'utf8');
    expect(text).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now|setTimeout|requestAnimationFrame/);
    expect(text).toContain('createEffectRandom');
    const files = [...readdirSync(`${src}rules`).map((f) => `${src}rules/${f}`), `${src}def.ts`, `${src}proof.ts`, `${src}view/scene.ts`, ...readdirSync(`${src}levels`).map((f) => `${src}levels/${f}`)];
    for (const file of files.filter((f) => !f.endsWith('.test.ts'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from '[^']*effects'/);
    }
    for (const file of files.filter((f) => /rules|levels/.test(f) && !f.endsWith('.test.ts'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/@kit\/shell/);
    }
  });
});
