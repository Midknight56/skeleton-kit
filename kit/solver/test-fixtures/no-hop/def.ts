// A copy of kit/conformance/sample-hop/def.ts with id no-hop. Its actions list only none, so every level is lost.
import { KitError, type GameDef, type Observation, type Scene, type SceneItem, type Status, type Viewport } from '@kit/core';

export type HopState = { cell: number; air: number; blocked: number[]; lost: boolean };
export type HopAction = 'none' | 'hop';

const CELLS = 40;
const GOAL = CELLS - 1;
const AIR_TICKS = 4;

const LEVEL_BLOCKED: Record<string, number[]> = {
  h1: [10],
  h2: [6, 14, 15, 30],
};

function status(state: HopState): Status {
  if (state.lost) return { phase: 'lost', score: state.cell, reason: 'landed on a blocked cell' };
  if (state.cell >= GOAL) return { phase: 'won', score: state.cell, reason: 'reached the last cell' };
  return { phase: 'playing', score: state.cell };
}

function actions(state: HopState): HopAction[] {
  return status(state).phase === 'playing' ? ['none'] : [];
}

function observe(state: HopState): Observation {
  const row: string[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (i === state.cell) row.push(state.air > 0 ? '^' : '@');
    else if (state.blocked.includes(i)) row.push('#');
    else if (i === GOAL) row.push('G');
    else row.push('.');
  }
  const phase = status(state).phase;
  const summary =
    phase === 'won' ? 'The runner reached the last cell.'
    : phase === 'lost' ? `The runner hit a blocked cell on cell ${state.cell}.`
    : `The runner is on cell ${state.cell} of ${GOAL}${state.air > 0 ? ' and in the air' : ''}.`;
  return {
    summary,
    textMap: [row.join('')],
    legend: { '@': 'runner on the ground', '^': 'runner in the air', '#': 'blocked cell', G: 'last cell', '.': 'free cell' },
    facts: { cell: state.cell, air: state.air, blocked: state.blocked.slice() },
  };
}

function view(state: HopState, viewport: Viewport): Scene {
  const { width, height, safe } = viewport;
  const usable = Math.max(CELLS, width - safe.left - safe.right);
  const cell = Math.max(1, Math.floor(usable / CELLS));
  const left = safe.left;
  const ground = Math.floor(height / 2);
  const items: SceneItem[] = [
    { kind: 'rect', id: 'background', layer: 'back', x: 0, y: 0, w: width, h: height, fill: '#203040' },
    { kind: 'rect', id: 'ground', layer: 'world', x: left, y: ground, w: cell * CELLS, h: cell, fill: '#506070' },
    { kind: 'rect', id: 'goal', layer: 'world', x: left + GOAL * cell, y: ground - cell * 2, w: cell, h: cell * 2, fill: '#60d080' },
  ];
  for (const block of state.blocked) {
    items.push({ kind: 'rect', id: `block-${block}`, layer: 'world', x: left + block * cell, y: ground - cell, w: cell, h: cell, fill: '#d06060' });
  }
  items.push({
    kind: 'rect',
    id: 'runner',
    layer: 'actors',
    x: left + state.cell * cell,
    y: ground - cell * (state.air > 0 ? 3 : 1),
    w: cell,
    h: cell,
    fill: '#ffd24a',
  });
  return { width, height, items };
}

export const noHop: GameDef<HopState, HopAction> = {
  id: 'no-hop',
  title: 'No hop',
  rulesVersion: '1',
  kind: 'tick',
  ticksPerSecond: 10,
  levels: () => [
    { id: 'h1', title: 'One block' },
    { id: 'h2', title: 'Four blocks' },
  ],
  init(levelId) {
    const blocked = LEVEL_BLOCKED[levelId];
    if (blocked === undefined) throw new KitError('unknown_level', `Unknown level ${levelId}`);
    return { cell: 0, air: 0, blocked: blocked.slice(), lost: false };
  },
  actions,
  step(state, action) {
    const copy: HopState = { cell: state.cell, air: state.air, blocked: state.blocked.slice(), lost: state.lost };
    if (!actions(state).includes(action)) return copy;
    let air = action === 'hop' && state.air === 0 ? AIR_TICKS : state.air;
    const cell = state.cell + 1;
    let lost = false;
    if (air > 0) air -= 1;
    else if (state.blocked.includes(cell)) lost = true;
    return { cell, air, blocked: copy.blocked, lost };
  },
  status,
  observe,
  view,
  encodeAction: (action) => action,
  decodeAction: (text) => (text === 'none' || text === 'hop' ? text : null),
};

export default noHop;
