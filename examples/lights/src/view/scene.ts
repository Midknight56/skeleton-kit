import type { Scene, SceneItem, Viewport } from '@kit/core';
import { SIZE, type LampState } from '../rules/state';

// The board is a square in the middle of the play area. Each lamp is an item with the id lamp-<x>-<y>.
export function view(state: LampState, viewport: Viewport): Scene {
  const { width, height, safe } = viewport;
  const room = Math.min(width - safe.left - safe.right, height - safe.top - safe.bottom);
  const cell = Math.max(1, Math.floor(room / SIZE));
  const left = safe.left + Math.floor((width - safe.left - safe.right - cell * SIZE) / 2);
  const top = safe.top + Math.floor((height - safe.top - safe.bottom - cell * SIZE) / 2);
  const items: SceneItem[] = [{ kind: 'rect', id: 'background', layer: 'back', x: 0, y: 0, w: width, h: height, fill: '#202030' }];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const on = state.lamps[y * SIZE + x] === 1;
      items.push({
        kind: 'rect',
        id: `lamp-${x}-${y}`,
        layer: 'world',
        x: left + x * cell + 2,
        y: top + y * cell + 2,
        w: Math.max(1, cell - 4),
        h: Math.max(1, cell - 4),
        fill: on ? '#ffd24a' : '#3a3a50',
        radius: 8,
      });
    }
  }
  return { width, height, items };
}
