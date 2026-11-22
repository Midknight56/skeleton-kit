import type { InputEvent, InputMap } from '@kit/shell';
import type { GardenState } from './rules/state';

const LANTERN_ITEM = /^lantern-([1-5])$/;
const LIGHT_ACTION = /^light:([1-5])$/;

// A tap on lantern k: light it, or wait when it is the lit one. Null when the level has no lantern k.
function tapLantern(k: number, state: GardenState): string | null {
  if (!state.cells.some((row) => row.includes(String(k)))) return null;
  return state.lit === k ? 'wait' : `light:${k}`;
}

// The reason the Wait button and the space key give when no lantern is lit.
function refusedText(actionText: string, state: GardenState): string | null {
  return actionText === 'wait' && state.lit === 0 ? 'Light a lantern first' : null;
}

function toAction(event: InputEvent, state: GardenState): string | null {
  if (event.type === 'pointer') {
    for (const id of event.itemIds) {
      const match = LANTERN_ITEM.exec(id);
      if (match) return tapLantern(Number(match[1]), state);
    }
    return null;
  }
  if (event.key >= '1' && event.key <= '5' && event.key.length === 1) return tapLantern(Number(event.key), state);
  if (event.key === ' ') return state.lit !== 0 ? 'wait' : null;
  return null;
}

export const gardenInput: InputMap<GardenState> = {
  idle: null,
  toAction,
  buttons: [{ id: 'wait', label: 'Wait', action: 'wait' }],
  anchorFor(actionText) {
    const match = LIGHT_ACTION.exec(actionText);
    if (match) return `lantern-${match[1]}`;
    return actionText === 'wait' ? 'wait' : null;
  },
  lessons: [
    { id: 'tap-lantern', anchor: 'lantern-1', text: 'Tap lantern' },
    { id: 'wait-turn', anchor: 'wait', text: 'Then wait' },
    { id: 'switch-lantern', anchor: 'lantern-2', text: 'Or switch' },
  ],
  keys: [
    '1 to 5: light that lantern',
    'Space: wait',
    'Tap another lantern to move the light',
    'A moth can rest on any free flower',
    'Win in the fewest moves for 3 stars',
    'A moth in a web, or no turns left: the level is lost',
  ],
  // The how to play screen shows these whole sentences. The chips above stay short.
  howTo: [
    'Tap a lantern, or press 1 to 5, to light it.',
    'Each turn, every moth flies one step toward the light.',
    'Tap Wait, or press Space, to pass a turn.',
    'Tap another lantern to move the light.',
    'A moth rests on a free flower.',
    'A hedge blocks the way.',
    'A web catches a moth.',
    'You win when every moth is on a flower.',
    'The fewest moves earn 3 stars.',
    'The level is lost if a web catches a moth or the turns run out.',
  ],
  refused: (actionText, state) => refusedText(actionText, state),
  refusedKey: (key, state) => {
    const text = key === ' ' ? refusedText('wait', state) : null;
    return text ? { anchor: 'wait', text } : null;
  },
};
