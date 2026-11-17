// Plain data. A state holds no function, no Date and no Map, so it can be saved, hashed and replayed.
export type LampState = { lamps: number[]; moves: number };
export type LampAction = { x: number; y: number };

// The board is SIZE by SIZE. A lamp is 1 when on and 0 when off.
export const SIZE = 4;
