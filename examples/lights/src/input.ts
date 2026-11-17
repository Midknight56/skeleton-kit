import type { InputEvent, InputMap } from '@kit/shell';
import type { LampState } from './rules/state';

const LAMP_ITEM = /^lamp-([0-3])-([0-3])$/;
const PRESS = /^press:([0-3]),([0-3])$/;

// A tap on a lamp presses it. Any other tap or key does nothing.
function toAction(event: InputEvent): string | null {
  if (event.type !== 'pointer') return null;
  for (const id of event.itemIds) {
    const match = LAMP_ITEM.exec(id);
    if (match) return `press:${match[1]},${match[2]}`;
  }
  return null;
}

export const gameInput: InputMap<LampState> = {
  idle: null,
  toAction,
  buttons: [],
  anchorFor(actionText) {
    const match = PRESS.exec(actionText);
    return match ? `lamp-${match[1]}-${match[2]}` : null;
  },
  lessons: [{ id: 'press-lamp', anchor: 'lamp-1-1', text: 'Tap lamp' }],
  keys: [],
};
