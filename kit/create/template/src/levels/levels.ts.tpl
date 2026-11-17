import type { LampAction } from '../rules/state';

// Each level starts from an empty board and applies these presses, so every level can be won.
export const LEVELS: { id: string; title: string; presses: LampAction[] }[] = [
  { id: 'l1', title: 'One press', presses: [{ x: 1, y: 1 }] },
  { id: 'l2', title: 'Two presses', presses: [{ x: 0, y: 0 }, { x: 2, y: 2 }] },
  { id: 'l3', title: 'Three presses', presses: [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 2 }] },
];
