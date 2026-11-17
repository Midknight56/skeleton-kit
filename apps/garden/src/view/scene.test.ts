import { validateScene, type Scene, type SceneItem, type Viewport } from '@kit/core';
import { describe, expect, it } from 'vitest';
import gardenDef from '../def';
import { fixtureA, fixtureB, fixtureC, fixtureD } from '../rules/fixtures';
import { parseLevel, type RawLevel } from '../rules/level';
import type { GardenState } from '../rules/state';
import { decodeAction, step } from '../rules/step';
import { boardLayout, view } from './scene';

const viewports: [string, Viewport][] = [
  ['360 by 640', { width: 360, height: 640, safe: { top: 0, right: 0, bottom: 0, left: 0 } }],
  ['360 by 640 with side safe areas of 36', { width: 360, height: 640, safe: { top: 24, right: 36, bottom: 34, left: 36 } }],
  ['1920 by 1080', { width: 1920, height: 1080, safe: { top: 0, right: 0, bottom: 0, left: 0 } }],
  ['conformance 320 by 240', { width: 320, height: 240, safe: { top: 0, right: 0, bottom: 0, left: 0 } }],
  ['conformance 400 by 300', { width: 400, height: 300, safe: { top: 12, right: 8, bottom: 16, left: 8 } }],
];

const draft = (() => {
  const state = gardenDef.init('g01', 1);
  return state;
})();

function start(raw: RawLevel): GardenState {
  const parsed = parseLevel(raw);
  if (!parsed.ok) throw new Error(parsed.problems.join('; '));
  return parsed.state;
}

function play(state: GardenState, texts: string[]): GardenState {
  let now = state;
  for (const text of texts) now = step(now, decodeAction(text)!);
  return now;
}

const count = (scene: Scene, layer: string, prefix: string): number =>
  scene.items.filter((item) => item.layer === layer && item.id.startsWith(prefix)).length;

const boards: [string, GardenState][] = [
  ['A', start(fixtureA)],
  ['B', start(fixtureB)],
  ['C', start(fixtureC)],
  ['D', start(fixtureD)],
  ['draft', draft],
  ['D lit', play(start(fixtureD), ['light:1', 'light:2'])],
  ['B lost', play(start(fixtureB), ['light:1', 'wait'])],
];

describe('boardLayout', () => {
  it('follows the formulas of the design', () => {
    const state = start(fixtureD); // 5 by 3
    const viewport: Viewport = { width: 400, height: 500, safe: { top: 10, right: 20, bottom: 30, left: 40 } };
    const availW = 400 - 40 - 20; // 340
    const availH = 500 - 10 - 56 - 30; // 404
    const cell = Math.max(1, Math.floor(Math.min(availW / 5, availH / 3)));
    expect(boardLayout(state, viewport)).toEqual({
      cell,
      left: 40 + Math.floor((availW - cell * 5) / 2),
      top: 10 + 56 + Math.floor((availH - cell * 3) / 2),
    });
  });

  it('keeps every board item at least 16 px inside the screen on 360x640, 768x1024 and 1920x1080, for every level', () => {
    // The play area is the screen above the 72 px control strip.
    const screens: [number, number][] = [[360, 640], [768, 1024], [1920, 1080]];
    const problems: string[] = [];
    for (const level of gardenDef.levels()) {
      const state = gardenDef.init(level.id, 1);
      for (const [w, h] of screens) {
        const viewport: Viewport = { width: w, height: h - 72, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
        for (const item of view(state, viewport).items) {
          if (item.kind !== 'sprite' && item.kind !== 'rect') continue;
          const where = `${level.id} at ${w}x${h}: ${item.id}`;
          if (item.x < 16) problems.push(`${where} starts at x ${item.x}`);
          if (item.y < 16) problems.push(`${where} starts at y ${item.y}`);
          if (item.x + item.w > w - 16) problems.push(`${where} ends at x ${item.x + item.w}, limit ${w - 16}`);
          if (item.y + item.h > h - 16) problems.push(`${where} ends at y ${item.y + item.h}, limit ${h - 16}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('gives a cell of at least 1 on a tiny viewport', () => {
    const tiny: Viewport = { width: 10, height: 10, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
    expect(boardLayout(start(fixtureD), tiny).cell).toBe(1);
  });

  it('gives a cell of 32 or more for a 9 by 7 board on 360 by 640 with side safe areas of 36', () => {
    const big = start({ id: 'big', title: 'Big', maxTurns: 9, rows: ['m.......f', '.........', '.........', '.........', '.........', '.........', '1........'] });
    expect(big.w).toBe(9);
    expect(big.h).toBe(7);
    const layout = boardLayout(big, viewports[1]![1]);
    expect(layout.cell).toBeGreaterThanOrEqual(32);
    expect(boardLayout(big, { width: 360, height: 640, safe: { top: 0, right: 36, bottom: 0, left: 36 } }).cell).toBeGreaterThanOrEqual(32);
  });
});

describe('view', () => {
  it.each(viewports)('has no scene problem on %s for fixtures A to D and the draft level', (_name, viewport) => {
    for (const [name, state] of boards) {
      const scene = view(state, viewport);
      expect(validateScene(scene), `${name}`).toEqual([]);
      expect(scene.width).toBe(viewport.width);
      expect(scene.height).toBe(viewport.height);
    }
  });

  it('has one world item for each hedge, web, flower and lantern, one actors item for each moth', () => {
    const state = start({ id: 'mix', title: 'Mix', maxTurns: 9, rows: ['m#wf', '..m1', '2.f.'] });
    const scene = view(state, viewports[0]![1]);
    expect(count(scene, 'world', 'hedge-')).toBe(1);
    expect(count(scene, 'world', 'web-')).toBe(1);
    expect(count(scene, 'world', 'flower-')).toBe(2);
    expect(count(scene, 'world', 'lantern-')).toBe(2);
    expect(scene.items.filter((item) => item.layer === 'world')).toHaveLength(6);
    expect(scene.items.filter((item) => item.layer === 'actors')).toHaveLength(2);
    expect(scene.items.filter((item) => item.layer === 'fx')).toHaveLength(0);
    expect(scene.items.filter((item) => item.layer === 'hud')).toHaveLength(1);
  });

  it('names items as in the design', () => {
    const state = start({ id: 'mix', title: 'Mix', maxTurns: 9, rows: ['m#wf', '..m1', '2.f.'] });
    const ids = view(state, viewports[0]![1]).items.map((item) => item.id).sort();
    expect(ids).toEqual(['flower-2-2', 'flower-3-0', 'hedge-1-0', 'hud-turn', 'lantern-1', 'lantern-2', 'moth-1', 'moth-2', 'web-2-0'].sort());
  });

  it('draws no glow disc and no moon, lit lantern or not: the lantern sprite is the light', () => {
    const viewport = viewports[0]![1];
    const lit = play(start(fixtureD), ['light:2']);
    for (const state of [lit, start(fixtureD)]) {
      const items = view(state, viewport).items;
      expect(items.filter((item) => /glow|moon/i.test(item.id))).toEqual([]);
      expect(items.filter((item) => item.kind === 'circle')).toEqual([]);
    }
  });

  it('uses the sprite names of the design', () => {
    const viewport = viewports[0]![1];
    const sprite = (scene: Scene, id: string): string => {
      const item = scene.items.find((entry) => entry.id === id) as Extract<SceneItem, { kind: 'sprite' }>;
      return item.sprite;
    };
    const first = view(start(fixtureD), viewport);
    expect(sprite(first, 'lantern-1')).toBe('lantern');
    expect(sprite(first, 'moth-1')).toBe('moth');
    expect(sprite(first, 'web-2-1')).toBe('web');
    expect(sprite(first, 'flower-3-0')).toBe('flower');
    const lit = view(play(start(fixtureD), ['light:1']), viewport);
    expect(sprite(lit, 'lantern-1')).toBe('lantern_lit');
    expect(sprite(lit, 'lantern-2')).toBe('lantern');
    const home = view(play(start(fixtureA), ['light:1', 'wait']), viewport);
    expect(sprite(home, 'moth-1')).toBe('moth_home');
    const caught = view(play(start(fixtureB), ['light:1', 'wait']), viewport);
    expect(sprite(caught, 'moth-1')).toBe('moth_caught');
  });

  it('puts cells at the layout position and sizes sprites to one cell', () => {
    const viewport = viewports[0]![1];
    const state = start(fixtureD);
    const { cell, left, top } = boardLayout(state, viewport);
    const moth = view(state, viewport).items.find((item) => item.id === 'moth-1') as Extract<SceneItem, { kind: 'sprite' }>;
    expect(moth).toMatchObject({ x: left, y: top + cell, w: cell, h: cell });
  });

  it('draws the turn counter as the design says', () => {
    const viewport: Viewport = { width: 360, height: 640, safe: { top: 20, right: 0, bottom: 0, left: 0 } };
    const hud = view(start(fixtureC), viewport).items.find((item) => item.id === 'hud-turn');
    expect(hud).toEqual({ kind: 'text', id: 'hud-turn', layer: 'hud', x: 180, y: 56, text: 'Turn 0 of 8', size: 24, fill: '#ffffff', align: 'center' });
  });

  it('has square cells of at least 32 px on 360 by 640 for a 9 by 7 board with side safe areas of 36', () => {
    const big = start({ id: 'big', title: 'Big', maxTurns: 9, rows: ['m.......f', '.........', '.........', '.........', '.........', '.........', '1........'] });
    const scene = view(big, viewports[1]![1]);
    const sizes = scene.items.filter((item) => item.kind === 'sprite').map((item) => (item as { w: number; h: number }));
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) {
      expect(size.w).toBe(size.h);
      expect(size.w).toBeGreaterThanOrEqual(32);
    }
  });

  it('starts no world or actors item above safe.top + 56', () => {
    for (const [, viewport] of viewports) {
      for (const [name, state] of boards) {
        for (const item of view(state, viewport).items) {
          if (item.layer !== 'world' && item.layer !== 'actors') continue;
          const top = item.kind === 'circle' ? item.cy - item.r : item.y;
          expect(top, `${name} ${item.id}`).toBeGreaterThanOrEqual(viewport.safe.top + 56);
        }
      }
    }
  });

  it('keeps every id the same across one turn, and has no repeated id', () => {
    const viewport = viewports[0]![1];
    const lit = play(start(fixtureC), ['light:1']);
    const before = view(lit, viewport).items.map((item) => item.id);
    const after = view(step(lit, { kind: 'wait' }), viewport).items.map((item) => item.id);
    expect(after).toEqual(before);
    expect(new Set(before).size).toBe(before.length);
  });

  it('does not change the state', () => {
    const state = play(start(fixtureC), ['light:1']);
    const copy = JSON.parse(JSON.stringify(state)) as GardenState;
    view(state, viewports[0]![1]);
    expect(state).toEqual(copy);
  });
});
