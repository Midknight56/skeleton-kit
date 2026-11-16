// Small game definitions for the tests in this folder. They follow the rules of the two
// sample games in kit/conformance, but kit/core may not import from another folder.
import type { GameDef, Status } from './types';

export type LightsState = { lamps: number[]; moves: number };
export type LightsAction = { x: number; y: number };

const LEVEL_PRESSES: Record<string, LightsAction[]> = {
  l1: [{ x: 1, y: 1 }],
  l2: [{ x: 0, y: 0 }, { x: 2, y: 2 }],
  l3: [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 2 }],
};

function flip(lamps: number[], action: LightsAction): number[] {
  const next = lamps.slice();
  const cells: [number, number][] = [
    [action.x, action.y],
    [action.x, action.y - 1],
    [action.x, action.y + 1],
    [action.x - 1, action.y],
    [action.x + 1, action.y],
  ];
  for (const [x, y] of cells) {
    if (x >= 0 && x < 3 && y >= 0 && y < 3) next[y * 3 + x] = 1 - (next[y * 3 + x] as number);
  }
  return next;
}

function lightsStatus(state: LightsState): Status {
  const on = state.lamps.filter((lamp) => lamp === 1).length;
  return on === 0 ? { phase: 'won', score: state.moves } : { phase: 'playing', score: state.moves };
}

export const lights: GameDef<LightsState, LightsAction> = {
  id: 'fixture-lights',
  title: 'Fixture lights',
  rulesVersion: '1',
  kind: 'turn',
  levels: () => [
    { id: 'l1', title: 'One' },
    { id: 'l2', title: 'Two' },
    { id: 'l3', title: 'Three' },
  ],
  init(levelId) {
    let lamps = new Array<number>(9).fill(0);
    for (const press of LEVEL_PRESSES[levelId] ?? []) lamps = flip(lamps, press);
    return { lamps, moves: 0 };
  },
  actions(state) {
    if (lightsStatus(state).phase !== 'playing') return [];
    const list: LightsAction[] = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) list.push({ x, y });
    return list;
  },
  step: (state, action) => ({ lamps: flip(state.lamps, action), moves: state.moves + 1 }),
  status: lightsStatus,
  observe: (state) => ({ summary: `${state.moves} moves`, facts: { moves: state.moves } }),
  view: (_state, viewport) => ({ width: viewport.width, height: viewport.height, items: [] }),
  encodeAction: (action) => `press:${action.x},${action.y}`,
  decodeAction(text) {
    const match = /^press:([0-2]),([0-2])$/.exec(text);
    return match === null ? null : { x: Number(match[1]), y: Number(match[2]) };
  },
};

export type HopState = { cell: number; air: number; blocked: number[]; lost: boolean };
export type HopAction = 'none' | 'hop';

function hopStatus(state: HopState): Status {
  if (state.lost) return { phase: 'lost', score: state.cell };
  if (state.cell >= 39) return { phase: 'won', score: state.cell };
  return { phase: 'playing', score: state.cell };
}

export const hop: GameDef<HopState, HopAction> = {
  id: 'fixture-hop',
  title: 'Fixture hop',
  rulesVersion: '1',
  kind: 'tick',
  ticksPerSecond: 10,
  levels: () => [
    { id: 'h1', title: 'One block' },
    { id: 'h2', title: 'Four blocks' },
  ],
  init: (levelId) => ({ cell: 0, air: 0, blocked: levelId === 'h2' ? [6, 14, 15, 30] : [10], lost: false }),
  actions: (state) => (hopStatus(state).phase === 'playing' ? ['none', 'hop'] : []),
  step(state, action) {
    let air = action === 'hop' && state.air === 0 ? 4 : state.air;
    const cell = state.cell + 1;
    let lost = false;
    if (air > 0) air -= 1;
    else if (state.blocked.includes(cell)) lost = true;
    return { cell, air, blocked: state.blocked.slice(), lost };
  },
  status: hopStatus,
  observe: (state) => ({ summary: `cell ${state.cell}`, facts: { cell: state.cell } }),
  view: (_state, viewport) => ({ width: viewport.width, height: viewport.height, items: [] }),
  encodeAction: (action) => action,
  decodeAction: (text) => (text === 'none' || text === 'hop' ? text : null),
};
