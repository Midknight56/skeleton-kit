import type { Scene, SceneItem, Viewport } from '@kit/core';
import { BOX_H, BOX_W, TILE } from '../rules/constants';
import type { RunnerState } from '../rules/state';

const BAR = 56;

export interface RunnerLayout {
  tile: number; // px of one column
  scale: number; // px of one unit
  playerLeft: number; // px, the fixed place of the player
  groundY: number; // px, the ground surface
}

/** Where the course sits. Pure, so that the shell can use the same numbers. */
export function runnerLayout(viewport: Viewport): RunnerLayout {
  const { width, height, safe } = viewport;
  const availW = width - safe.left - safe.right;
  const availH = height - safe.top - safe.bottom;
  // A screen taller than wide fits the course to its height, so the rider and the ground are big enough
  // to see. The tile is also at most 14 percent of the width, which keeps 5 tiles of course in view
  // right of the rider, who stands a fifth of the way in. Other screens fit the course to the width.
  const tile =
    height > width
      ? Math.max(1, Math.min(Math.floor(availH / 12), Math.floor(availW * 0.14)))
      : Math.max(1, Math.floor(availW / 15));
  return {
    tile,
    scale: tile / TILE,
    playerLeft: safe.left + Math.floor(availW / (height > width ? 5 : 4)),
    groundY: safe.top + BAR + Math.floor(((height - safe.top - BAR - safe.bottom) * 3) / 4),
  };
}

// Fractions of the free area for the stars: across the width and down from the bar.
const STARS: [number, number][] = [
  [0.1, 0.1],
  [0.3, 0.22],
  [0.52, 0.07],
  [0.62, 0.3],
  [0.18, 0.42],
  [0.88, 0.4],
  [0.42, 0.5],
];

/** The night sky behind the course. Static: it does not depend on the state. All items are in the back layer. */
function backdrop(viewport: Viewport): SceneItem[] {
  const { width, safe } = viewport;
  const { groundY } = runnerLayout(viewport);
  const availW = width - safe.left - safe.right;
  const top = safe.top + BAR;
  const area = Math.max(1, groundY - top);
  const items: SceneItem[] = [{ kind: 'sprite', id: 'back-sky', layer: 'back', x: 0, y: 0, w: width, h: groundY, sprite: 'sky' }];
  const starSize = Math.max(8, Math.round(availW * 0.03));
  STARS.forEach(([fx, fy], i) => {
    items.push({
      kind: 'sprite',
      id: `back-star-${i + 1}`,
      layer: 'back',
      x: safe.left + Math.round(fx * (availW - starSize)),
      y: top + Math.round(fy * (area - starSize)),
      w: starSize,
      h: starSize,
      sprite: 'star',
      opacity: i % 2 === 0 ? 1 : 0.6,
    });
  });
  const moon = Math.max(24, Math.round(availW * 0.14));
  items.push({
    kind: 'sprite',
    id: 'back-moon',
    layer: 'back',
    x: safe.left + availW - moon - Math.round(availW * 0.1),
    y: top + Math.round(area * 0.08),
    w: moon,
    h: moon,
    sprite: 'moon',
  });
  const far = Math.round(area * 0.3);
  const near = Math.round(area * 0.17);
  items.push({ kind: 'sprite', id: 'back-hills-far', layer: 'back', x: 0, y: groundY - far, w: width, h: far, sprite: 'hills_far' });
  items.push({ kind: 'sprite', id: 'back-hills-near', layer: 'back', x: 0, y: groundY - near, w: width, h: near, sprite: 'hills_near' });
  return items;
}

export function view(state: RunnerState, viewport: Viewport): Scene {
  const { tile, scale, playerLeft, groundY } = runnerLayout(viewport);
  const items: SceneItem[] = backdrop(viewport);
  const left = (column: number): number => playerLeft + (column * TILE - state.x) * scale;
  const inside = (column: number): boolean => left(column) < viewport.width && left(column) + tile > 0;
  const below = Math.max(1, viewport.height - groundY);

  for (let column = 0; column < state.ground.length; column++) {
    if (!inside(column)) continue;
    const char = state.ground.charAt(column);
    const x = left(column);
    if (char !== '.') items.push({ kind: 'sprite', id: `ground-${column}`, layer: 'world', x, y: groundY, w: tile, h: below, sprite: 'ground' });
    if (char === 'p') items.push({ kind: 'sprite', id: `pumpkin-${column}`, layer: 'world', x, y: groundY - tile, w: tile, h: tile, sprite: 'pumpkin' });
    if (char === 'P') items.push({ kind: 'sprite', id: `post-${column}`, layer: 'world', x, y: groundY - 640 * scale, w: tile, h: 640 * scale, sprite: 'post' });
    if (char === 'G') items.push({ kind: 'sprite', id: `gate-${column}`, layer: 'world', x, y: groundY - 2 * tile, w: tile, h: 2 * tile, sprite: 'gate' });
  }

  for (const index of state.candles) {
    const high = index >= 1000;
    const column = high ? index - 1000 : index;
    // The candle sits inside its column, so its own box decides, not the box of the column.
    const x = left(column) + 128 * scale;
    if (x >= viewport.width || x + 256 * scale <= 0) continue;
    items.push({
      kind: 'sprite',
      id: `candle-${column}-${high ? 2 : 1}`,
      layer: 'world',
      x,
      y: groundY - (high ? 1408 : 896) * scale,
      w: 256 * scale,
      h: 256 * scale,
      sprite: 'candle',
    });
  }

  items.push({
    kind: 'sprite',
    id: 'player',
    layer: 'actors',
    x: playerLeft,
    y: groundY + state.feetY * scale - BOX_H * scale,
    w: BOX_W * scale,
    h: BOX_H * scale,
    sprite: state.phase === 'lost' ? 'broom_down' : 'broom',
  });

  items.push({
    kind: 'text',
    id: 'hud-score',
    layer: 'hud',
    x: viewport.width / 2,
    y: viewport.safe.top + 36,
    text: String(state.score),
    size: 24,
    fill: '#ffffff',
    align: 'center',
  });
  return { width: viewport.width, height: viewport.height, items };
}
