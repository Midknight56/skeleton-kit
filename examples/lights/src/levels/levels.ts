import type { LampAction } from '../rules/state';

// Each level starts from an empty board and applies these presses on different cells, so every level
// can be won. Level n has n presses.
export const LEVELS: { id: string; title: string; presses: LampAction[] }[] = [
  { id: 'l1', title: 'One press', presses: [{ x: 1, y: 1 }] },
  { id: 'l2', title: 'Two presses', presses: [{ x: 0, y: 0 }, { x: 3, y: 3 }] },
  { id: 'l3', title: 'Three presses', presses: [{ x: 0, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 3 }] },
  { id: 'l4', title: 'Four presses', presses: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 3 }] },
  { id: 'l5', title: 'Five presses', presses: [{ x: 1, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 2 }, { x: 3, y: 2 }, { x: 1, y: 3 }] },
  { id: 'l6', title: 'Six presses', presses: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 0, y: 2 }, { x: 2, y: 3 }] },
];
