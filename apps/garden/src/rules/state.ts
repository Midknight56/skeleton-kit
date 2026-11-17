import type { RawLevel } from './level';

export type Moth = { id: number; x: number; y: number; home: boolean; caught: boolean };

export type GardenState = {
  level: string;
  w: number;
  h: number;
  cells: string[]; // rows with '.', '#', 'w', 'f' and '1' to '5'. A moth start cell is stored as '.'.
  moths: Moth[]; // ascending id
  lit: number; // 0 means no lantern is lit
  turn: number;
  maxTurns: number;
};

/** Builds the start state of a level that has no problems. Moths are numbered in reading order. */
export function initState(raw: RawLevel): GardenState {
  const moths: Moth[] = [];
  const cells = raw.rows.map((row, y) => {
    let out = '';
    for (let x = 0; x < row.length; x++) {
      const ch = row.charAt(x);
      if (ch === 'm') {
        moths.push({ id: moths.length + 1, x, y, home: false, caught: false });
        out += '.';
      } else {
        out += ch;
      }
    }
    return out;
  });
  return {
    level: raw.id,
    w: cells[0]?.length ?? 0,
    h: cells.length,
    cells,
    moths,
    lit: 0,
    turn: 0,
    maxTurns: raw.maxTurns,
  };
}
