// A copy of kit/conformance/sample-lights/def.ts. The kit boundary lets this package import only kit/core.
import { KitError, type GameDef, type Observation, type Scene, type SceneItem, type Status, type Viewport } from '@kit/core';

export type LightsState = { lamps: number[]; moves: number };
export type LightsAction = { x: number; y: number };

const SIZE = 3;

// Each level starts from an empty board and applies these presses, so every level can be won.
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
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) next[y * SIZE + x] = 1 - (next[y * SIZE + x] as number);
  }
  return next;
}

function lampsOn(state: LightsState): number {
  return state.lamps.filter((lamp) => lamp === 1).length;
}

function status(state: LightsState): Status {
  if (lampsOn(state) === 0) return { phase: 'won', score: state.moves, reason: 'every lamp is off' };
  return { phase: 'playing', score: state.moves };
}

function actions(state: LightsState): LightsAction[] {
  if (status(state).phase !== 'playing') return [];
  const list: LightsAction[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) list.push({ x, y });
  return list;
}

function observe(state: LightsState): Observation {
  const on = lampsOn(state);
  const textMap: string[] = [];
  for (let y = 0; y < SIZE; y++) {
    textMap.push(state.lamps.slice(y * SIZE, y * SIZE + SIZE).map((lamp) => (lamp === 1 ? '#' : '.')).join(''));
  }
  return {
    summary: on === 0 ? 'Every lamp is off.' : `${on} lamp${on === 1 ? ' is' : 's are'} on. A press flips a lamp and its neighbours.`,
    textMap,
    legend: { '#': 'lamp on', '.': 'lamp off' },
    facts: { lampsOn: on, moves: state.moves },
  };
}

function view(state: LightsState, viewport: Viewport): Scene {
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

export const sampleLights: GameDef<LightsState, LightsAction> = {
  id: 'sample-lights',
  title: 'Sample lights',
  rulesVersion: '1',
  kind: 'turn',
  levels: () => [
    { id: 'l1', title: 'One press' },
    { id: 'l2', title: 'Two presses' },
    { id: 'l3', title: 'Three presses' },
  ],
  init(levelId) {
    const presses = LEVEL_PRESSES[levelId];
    if (presses === undefined) throw new KitError('unknown_level', `Unknown level ${levelId}`);
    let lamps = new Array<number>(SIZE * SIZE).fill(0);
    for (const press of presses) lamps = flip(lamps, press);
    return { lamps, moves: 0 };
  },
  actions,
  step(state, action) {
    const listed = actions(state).some((a) => a.x === action.x && a.y === action.y);
    if (!listed) return { lamps: state.lamps.slice(), moves: state.moves };
    return { lamps: flip(state.lamps, action), moves: state.moves + 1 };
  },
  status,
  observe,
  view,
  encodeAction: (action) => `press:${action.x},${action.y}`,
  decodeAction(text) {
    const match = /^press:([0-2]),([0-2])$/.exec(text);
    if (match === null) return null;
    return { x: Number(match[1]), y: Number(match[2]) };
  },
};

export default sampleLights;
