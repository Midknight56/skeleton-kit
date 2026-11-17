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
  const tile = Math.max(1, Math.floor(availW / 15));
  return {
    tile,
    scale: tile / TILE,
    playerLeft: safe.left + Math.floor(availW / 4),
    groundY: safe.top + BAR + Math.floor(((height - safe.top - BAR - safe.bottom) * 3) / 4),
  };
}

export function view(state: RunnerState, viewport: Viewport): Scene {
  const { tile, scale, playerLeft, groundY } = runnerLayout(viewport);
  const items: SceneItem[] = [];
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
