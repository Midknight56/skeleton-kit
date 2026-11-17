import { validateScene, type SceneItem, type Viewport } from '@kit/core';
import { describe, expect, it } from 'vitest';
import shipped from '../levels/courses.json';
import { fixtureA, fixtureB, fixtureD1, fixtureD2, fixtureG } from '../rules/fixtures';
import { initState, type RawCourse, type RunnerState } from '../rules/state';
import { step, type RunnerAction } from '../rules/step';
import { runnerLayout, view } from './scene';

const portrait: Viewport = { width: 360, height: 640, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
const viewports: Viewport[] = [
  portrait,
  { width: 1920, height: 1080, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { width: 320, height: 240, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { width: 400, height: 300, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { width: 390, height: 844, safe: { top: 47, right: 0, bottom: 34, left: 0 } },
  { width: 844, height: 390, safe: { top: 0, right: 47, bottom: 21, left: 47 } },
];

const none = (n: number): RunnerAction[] => Array.from({ length: n }, () => 'none');

function after(course: RawCourse, list: RunnerAction[]): RunnerState {
  let state = initState(course);
  for (const action of list) state = step(state, action);
  return state;
}

/** Some states to draw: the start, in the air after a jump, at the top of the jump, and right after the last candle. */
function states(course: RawCourse): RunnerState[] {
  return [initState(course), after(course, ['jump', ...none(5)]), after(course, ['jump', ...none(15)]), after(course, [...none(110), 'jump', ...none(6)])];
}

const idsOf = (items: SceneItem[]): string[] => items.map((item) => item.id);
const topOf = (item: SceneItem): number => {
  if (item.kind === 'circle') return item.cy - item.r;
  return item.y;
};

describe('scene is valid', () => {
  it.each(viewports.map((viewport) => [`${viewport.width} by ${viewport.height}`, viewport] as const))('has no problem at %s', (_name, viewport) => {
    for (const course of [fixtureA, fixtureB, fixtureD1, fixtureD2, fixtureG]) {
      for (const state of states(course)) {
        const scene = view(state, viewport);
        expect(validateScene(scene), `${course.id} at tick ${state.tick}`).toEqual([]);
        expect(scene.width).toBe(viewport.width);
        expect(scene.height).toBe(viewport.height);
      }
    }
  });

  it('has no problem at any tick of a run past a candle, at each viewport', () => {
    // A candle sits inside its column, so a column can be partly inside the scene while its candle is not.
    for (const viewport of viewports) {
      for (const course of [fixtureD1, fixtureD2, ...(shipped as RawCourse[]).slice(0, 2)]) {
        let state = initState(course);
        for (let tick = 0; tick < 500; tick++) {
          expect(validateScene(view(state, viewport)), `${course.id} at tick ${state.tick}, ${viewport.width} by ${viewport.height}`).toEqual([]);
          state = step(state, 'none');
        }
      }
    }
  });

  it('draws at tick 0 and after a jump at 360 by 640 and 320 by 240', () => {
    for (const viewport of [portrait, viewports[2]!]) {
      expect(view(initState(fixtureB), viewport).items.length).toBeGreaterThan(3);
      expect(view(after(fixtureB, ['jump']), viewport).items.some((item) => item.id === 'player')).toBe(true);
    }
  });
});

describe('scene numbers at 360 by 640', () => {
  const layout = runnerLayout(portrait);

  it('has tile 24, scale 0.046875, player left 90 and ground at 494', () => {
    expect(layout.tile).toBe(24);
    expect(layout.scale).toBe(0.046875);
    expect(layout.playerLeft).toBe(90);
    expect(layout.groundY).toBe(494);
  });

  it('draws the player 15 by 21 px, with its right edge at 105 and its feet on the ground', () => {
    const player = view(initState(fixtureB), portrait).items.find((item) => item.id === 'player');
    expect(player).toMatchObject({ x: 90, w: 15, h: 21 });
    expect(player && 'y' in player ? player.y + 21 : 0).toBe(494);
  });

  it('shows 10 whole tiles ahead of the player at tick 0, columns 1 to 10, and column 11 partly', () => {
    const items = view(initState(fixtureA), portrait).items;
    const ground = (column: number): SceneItem | undefined => items.find((item) => item.id === `ground-${column}`);
    for (let column = 1; column <= 10; column++) {
      const item = ground(column) as { x: number; w: number };
      expect(item.x, `column ${column}`).toBe(90 + 24 * column);
      expect(item.x + item.w, `column ${column}`).toBeLessThanOrEqual(354 + 0.0001);
    }
    expect((ground(1) as { x: number }).x).toBe(114);
    expect((ground(10) as { x: number }).x).toBe(330);
    expect((ground(11) as { x: number; w: number }).x).toBe(354);
    expect((ground(11) as { x: number; w: number }).x + 24).toBeGreaterThan(360);
    expect(ground(12)).toBeUndefined();
  });

  it('moves the course left by one unit scale for each unit of x', () => {
    const state = after(fixtureB, none(10));
    const left = (view(state, portrait).items.find((item) => item.id === 'pumpkin-10') as { x: number }).x;
    expect(left).toBeCloseTo(90 + (10 * 512 - 440) * 0.046875, 9);
  });
});

describe('scene layers and ids', () => {
  it('puts no world or actors item above the bar', () => {
    for (const viewport of viewports) {
      for (const course of [fixtureA, fixtureD2]) {
        for (const state of states(course)) {
          for (const item of view(state, viewport).items) {
            if (item.layer !== 'world' && item.layer !== 'actors') continue;
            expect(topOf(item), `${item.id} at ${viewport.width} by ${viewport.height}, tick ${state.tick}`).toBeGreaterThanOrEqual(viewport.safe.top + 56);
          }
        }
      }
    }
  });

  it('has the score as the only hud item and puts it inside the bar', () => {
    for (const viewport of viewports) {
      const hud = view(after(fixtureD1, [...none(110), 'jump', ...none(2)]), viewport).items.filter((item) => item.layer === 'hud');
      expect(hud).toHaveLength(1);
      const score = hud[0]!;
      expect(score).toMatchObject({ kind: 'text', id: 'hud-score', text: '10' });
      if (score.kind !== 'text') throw new Error('the score is text');
      expect(score.y).toBeGreaterThanOrEqual(viewport.safe.top);
      expect(score.y).toBeLessThanOrEqual(viewport.safe.top + 56);
    }
  });

  it('does not repeat an id', () => {
    for (const viewport of viewports) {
      for (const state of states(fixtureD1)) {
        const ids = idsOf(view(state, viewport).items);
        expect(new Set(ids).size, `${viewport.width} by ${viewport.height}`).toBe(ids.length);
      }
    }
  });

  it('names items player, ground, pumpkin, post, gate, candle and hud-score', () => {
    const ids = idsOf(view(initState(fixtureD1), portrait).items);
    expect(ids).toContain('player');
    expect(ids).toContain('hud-score');
    expect(ids).toContain('candle-10-1');
    expect(idsOf(view(initState(fixtureD2), portrait).items)).toContain('candle-10-2');
    expect(idsOf(view(initState(fixtureB), portrait).items)).toContain('pumpkin-10');
    expect(idsOf(view(initState(fixtureG), portrait).items)).toContain('post-10');
    const nearGate = after(fixtureA, none(400));
    expect(idsOf(view(nearGate, portrait).items)).toContain('gate-39');
  });

  it('leaves out a taken candle and a column that is wholly outside the scene', () => {
    const taken = after(fixtureD1, [...none(110), 'jump', ...none(2)]);
    expect(idsOf(view(taken, portrait).items)).not.toContain('candle-10-1');
    const ids = idsOf(view(initState(fixtureA), portrait).items);
    expect(ids).not.toContain('ground-12');
    expect(ids).not.toContain('gate-39');
  });
});
