import type { InputEvent, InputMap } from '@kit/shell';
import type { RunnerState } from './rules/state';

// One tap anywhere, or the space key, is a jump. The shell passes on only a legal action, so a jump
// in the air changes nothing.
function toAction(event: InputEvent): string | null {
  if (event.type === 'pointer') return 'jump';
  return event.key === ' ' ? 'jump' : null;
}

export const runnerInput: InputMap<RunnerState> = {
  idle: 'none',
  toAction,
  buttons: [],
  anchorFor: (actionText) => (actionText === 'jump' ? 'player' : null),
  lessons: [
    { id: 'jump', anchor: 'player', text: 'Tap: jump' },
    { id: 'candles', anchor: 'hud-score', text: 'Take candles' },
  ],
  keys: ['Space: jump'],
};
