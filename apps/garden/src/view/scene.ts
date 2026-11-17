import type { Scene, SceneItem, Viewport } from '@kit/core';
import type { GardenState } from '../rules/state';

const BAR = 56;

/** Where the board sits. Pure, so that the shell can map a tap to a cell. */
export function boardLayout(state: GardenState, viewport: Viewport): { cell: number; left: number; top: number } {
  const { width, height, safe } = viewport;
  const availW = width - safe.left - safe.right;
  const availH = height - safe.top - BAR - safe.bottom;
  const cell = Math.max(1, Math.floor(Math.min(availW / state.w, availH / state.h)));
  const left = safe.left + Math.floor((availW - cell * state.w) / 2);
  const top = safe.top + BAR + Math.floor((availH - cell * state.h) / 2);
  return { cell, left, top };
}

const SPRITE_FOR_CELL: Record<string, string> = { '#': 'hedge', w: 'web', f: 'flower' };

export function view(state: GardenState, viewport: Viewport): Scene {
  const { cell, left, top } = boardLayout(state, viewport);
  const items: SceneItem[] = [];
  const at = (x: number, y: number): { x: number; y: number; w: number; h: number } => ({
    x: left + x * cell,
    y: top + y * cell,
    w: cell,
    h: cell,
  });

  const lanterns: { id: number; x: number; y: number }[] = [];
  for (let y = 0; y < state.h; y++) {
    const row = state.cells[y]!;
    for (let x = 0; x < state.w; x++) {
      const ch = row.charAt(x);
      const name = SPRITE_FOR_CELL[ch];
      if (name !== undefined) items.push({ kind: 'sprite', id: `${name}-${x}-${y}`, layer: 'world', ...at(x, y), sprite: name });
      else if (ch >= '1' && ch <= '5') lanterns.push({ id: Number(ch), x, y });
    }
  }
  lanterns.sort((a, b) => a.id - b.id);
  for (const lantern of lanterns) {
    const sprite = lantern.id === state.lit ? 'lantern_lit' : 'lantern';
    items.push({ kind: 'sprite', id: `lantern-${lantern.id}`, layer: 'world', ...at(lantern.x, lantern.y), sprite });
  }

  for (const moth of state.moths) {
    const sprite = moth.caught ? 'moth_caught' : moth.home ? 'moth_home' : 'moth';
    items.push({ kind: 'sprite', id: `moth-${moth.id}`, layer: 'actors', ...at(moth.x, moth.y), sprite });
  }

  const lit = lanterns.find((lantern) => lantern.id === state.lit);
  if (lit !== undefined) {
    items.push({
      kind: 'circle',
      id: 'glow',
      layer: 'fx',
      cx: left + lit.x * cell + cell / 2,
      cy: top + lit.y * cell + cell / 2,
      r: 1.5 * cell,
      fill: '#ffffff',
      opacity: 0.35,
    });
  }

  items.push({
    kind: 'text',
    id: 'hud-turn',
    layer: 'hud',
    x: viewport.width / 2,
    y: viewport.safe.top + 36,
    text: `Turn ${state.turn} of ${state.maxTurns}`,
    size: 24,
    fill: '#ffffff',
    align: 'center',
  });
  return { width: viewport.width, height: viewport.height, items };
}
