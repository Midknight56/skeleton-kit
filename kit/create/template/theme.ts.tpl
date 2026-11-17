import type { SoundRecipe, Theme } from '@kit/shell';

// A first pick of colours, shapes and sounds. Change them to give the game a look of its own.
// This game draws plain rectangles, so it has no sprites.
const sound = (wave: SoundRecipe['wave'], gain: number, ...notes: [number, number][]): SoundRecipe => ({
  wave,
  gain,
  notes: notes.map(([hz, ms]) => ({ hz, ms })),
});

export const gameTheme: Theme = {
  name: '__ID__',
  palette: {
    background: '#202030',
    surface: '#30304a',
    primary: '#ffb020',
    secondary: '#30c0b0',
    accent: '#ff7a59',
    text: '#ffffff',
    muted: '#b0b0c8',
    danger: '#ff5a6e',
  },
  buttonRadius: 12,
  typeScale: { small: 14, body: 18, title: 32 },
  signature: 'star',
  sprites: {},
  sounds: {
    tap: sound('sine', 0.15, [660, 50]),
    move: sound('triangle', 0.15, [440, 60], [550, 60]),
    win: sound('triangle', 0.2, [523, 120], [659, 120], [784, 200]),
    lose: sound('sawtooth', 0.12, [330, 160], [247, 260]),
    pickup: sound('square', 0.1, [880, 60]),
  },
  music: sound('sine', 0.04, [262, 400], [330, 400], [392, 400], [330, 400]),
};
