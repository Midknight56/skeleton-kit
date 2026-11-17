import type { SoundRecipe, Theme } from '@kit/shell';

// The sprites are hand-written SVG files in assets/, drawn for this project with the palette below.
// Each file is small, so the build inlines it and the page loads no extra file for it.
import broom from './assets/broom.svg';
import broomDown from './assets/broom_down.svg';
import candle from './assets/candle.svg';
import gapEdge from './assets/gap_edge.svg';
import gate from './assets/gate.svg';
import ground from './assets/ground.svg';
import post from './assets/post.svg';
import pumpkin from './assets/pumpkin.svg';

const sprites: Record<string, string> = {
  ground,
  gap_edge: gapEdge,
  pumpkin,
  post,
  gate,
  candle,
  broom,
  broom_down: broomDown,
};

const sound = (wave: SoundRecipe['wave'], gain: number, ...notes: [number, number][]): SoundRecipe => ({
  wave,
  gain,
  notes: notes.map(([hz, ms]) => ({ hz, ms })),
});

export const runnerTheme: Theme = {
  name: 'dusk run',
  palette: {
    background: '#0e1a33',
    surface: '#1d2e57',
    primary: '#ff7a1a',
    secondary: '#35c2c9',
    accent: '#e8f04a',
    text: '#ffffff',
    muted: '#9fb0d6',
    danger: '#ff4d6d',
  },
  buttonRadius: 6,
  typeScale: { small: 14, body: 17, title: 38 },
  signature: 'notch',
  sprites,
  sounds: {
    tap: sound('square', 0.08, [520, 40]),
    move: sound('square', 0.08, [440, 40]),
    win: sound('square', 0.12, [523, 90], [659, 90], [784, 90], [1047, 220]),
    lose: sound('sawtooth', 0.1, [300, 120], [200, 120], [140, 260]),
    pickup: sound('triangle', 0.15, [988, 50], [1319, 90]),
  },
  music: sound('triangle', 0.04, [196, 300], [247, 300], [294, 300], [247, 300], [220, 300], [262, 300], [330, 300], [262, 300]),
};
