import { validateScene, type SceneItem, type Viewport } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { runnerTheme } from '../../theme';
import shipped from '../levels/courses.json';
import { fixtureB } from '../rules/fixtures';
import { initState, type RawCourse } from '../rules/state';
import { step } from '../rules/step';
import { runnerLayout, view } from './scene';

// The night sky behind the course: a sky, a moon, a few stars and two rows of hills. It sits in
// the `back` layer, so the painter draws it before the world, the actors and the hud.

const viewports: Viewport[] = [
  { width: 360, height: 640, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { width: 375, height: 667, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { width: 390, height: 844, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { width: 412, height: 915, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { width: 768, height: 1024, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { width: 1280, height: 720, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { width: 1920, height: 1080, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { width: 320, height: 240, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { width: 400, height: 300, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  { width: 390, height: 844, safe: { top: 47, right: 0, bottom: 34, left: 0 } },
  { width: 844, height: 390, safe: { top: 0, right: 47, bottom: 21, left: 47 } },
];

const BAR = 56;
const PLAY_LAYERS = ['world', 'actors', 'fx', 'hud'];
const STAR_COUNT = 7;
const backOf = (items: SceneItem[]): SceneItem[] => items.filter((item) => item.layer === 'back');
const byId = (items: SceneItem[], id: string): SceneItem | undefined => items.find((item) => item.id === id);
const label = (v: Viewport): string => `${v.width} by ${v.height} safe ${v.safe.top}/${v.safe.right}/${v.safe.bottom}/${v.safe.left}`;

describe('runner night sky backdrop', () => {
  for (const viewport of viewports) {
    describe(label(viewport), () => {
      const course = (shipped as RawCourse[])[0]!;
      const scene = view(initState(course), viewport);
      const back = backOf(scene.items);

      it('has a sky, a moon, stars and two hills, all sprites in the back layer', () => {
        const ids = ['back-sky', 'back-moon', 'back-hills-far', 'back-hills-near', ...Array.from({ length: STAR_COUNT }, (_, i) => `back-star-${i + 1}`)];
        for (const id of ids) {
          const item = byId(scene.items, id);
          expect(item, id).toBeDefined();
          expect(item!.layer, id).toBe('back');
          expect(item!.kind, id).toBe('sprite');
        }
        expect(back).toHaveLength(ids.length);
      });

      it('names only sprites that the theme has', () => {
        for (const item of back) {
          if (item.kind === 'sprite') expect(Object.keys(runnerTheme.sprites), item.id).toContain(item.sprite);
        }
      });

      it('lists the backdrop before every play item, so that nothing covers the player, an obstacle or the hud', () => {
        const firstPlay = scene.items.findIndex((item) => PLAY_LAYERS.includes(item.layer));
        const lastBack = scene.items.map((item) => item.layer).lastIndexOf('back');
        expect(firstPlay).toBeGreaterThan(lastBack);
        expect(scene.items.some((item) => item.id === 'player')).toBe(true);
        expect(scene.items.some((item) => item.id === 'hud-score')).toBe(true);
      });

      it('passes validateScene', () => {
        expect(validateScene(scene)).toEqual([]);
      });

      it('fills the empty area: the sky spans the scene down to the ground, and moon and stars sit under the bar', () => {
        const { groundY } = runnerLayout(viewport);
        const sky = byId(scene.items, 'back-sky') as Extract<SceneItem, { kind: 'sprite' }>;
        expect(sky.x).toBeLessThanOrEqual(0);
        expect(sky.x + sky.w).toBeGreaterThanOrEqual(viewport.width);
        expect(sky.y).toBeLessThanOrEqual(0);
        expect(sky.y + sky.h).toBeGreaterThanOrEqual(groundY);
        for (const item of back.filter((i) => i.id === 'back-moon' || i.id.startsWith('back-star-'))) {
          const box = item as Extract<SceneItem, { kind: 'sprite' }>;
          expect(box.y, item.id).toBeGreaterThanOrEqual(viewport.safe.top + BAR);
          expect(box.y + box.h, item.id).toBeLessThanOrEqual(groundY);
          expect(box.x, item.id).toBeGreaterThanOrEqual(viewport.safe.left);
          expect(box.x + box.w, item.id).toBeLessThanOrEqual(viewport.width - viewport.safe.right);
        }
        for (const id of ['back-hills-far', 'back-hills-near']) {
          const hills = byId(scene.items, id) as Extract<SceneItem, { kind: 'sprite' }>;
          expect(hills.y + hills.h, id).toBe(groundY);
          expect(hills.x, id).toBeLessThanOrEqual(0);
          expect(hills.x + hills.w, id).toBeGreaterThanOrEqual(viewport.width);
        }
      });
    });
  }

  it('does not move with the course: the same items at tick 0 and after 200 ticks', () => {
    const course = (shipped as RawCourse[])[0]!;
    const viewport = viewports[0]!;
    let state = initState(course);
    const first = backOf(view(state, viewport).items);
    for (let i = 0; i < 200; i++) state = step(state, 'none');
    expect(backOf(view(state, viewport).items)).toEqual(first);
  });

  it('is the same on a fixture course, so the backdrop does not depend on the course', () => {
    const viewport = viewports[0]!;
    const a = backOf(view(initState(fixtureB), viewport).items);
    const b = backOf(view(initState((shipped as RawCourse[])[0]!), viewport).items);
    expect(a).toEqual(b);
  });
});
