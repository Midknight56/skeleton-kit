import type { SoundRecipe, Theme } from '@kit/shell';

// The sprites are hand-written SVG files in assets/, drawn for this project with the palette below.
// Each file is small, so the build inlines it and the page loads no extra file for it.
import broom from './assets/broom.svg';
import broomDown from './assets/broom_down.svg';
import candle from './assets/candle.svg';
import gapEdge from './assets/gap_edge.svg';
import gate from './assets/gate.svg';
import ground from './assets/ground.svg';
import hillsFar from './assets/hills_far.svg';
import hillsNear from './assets/hills_near.svg';
import moon from './assets/moon.svg';
import post from './assets/post.svg';
import pumpkin from './assets/pumpkin.svg';
import sky from './assets/sky.svg';
import star from './assets/star.svg';
import { narrowArt, wideArt } from './src/view/puppets';

const sprites: Record<string, string> = {
  ground,
  gap_edge: gapEdge,
  pumpkin,
  post,
  gate,
  candle,
  broom,
  broom_down: broomDown,
  sky,
  moon,
  star,
  hills_far: hillsFar,
  hills_near: hillsNear,
};

const sound = (wave: SoundRecipe['wave'], gain: number, ...notes: [number, number][]): SoundRecipe => ({
  wave,
  gain,
  notes: notes.map(([hz, ms]) => ({ hz, ms })),
});

// One disc of the moon, as a gradient layer. The centre of the moon is 34 menu px from the top and the
// right edge of the card, so it grows with `--u`. `dx` and `dy` move a disc from that centre, in menu px.
const disc = (dx: number, dy: number, colour: string, radius: number): string => {
  const at = (n: number) => `calc(${n} * var(--u))`;
  return `radial-gradient(circle ${at(radius)} at calc(100% - ${at(34 - dx)}) ${at(34 + dy)}, ${colour} 88%, ${colour.slice(0, 7)}00 100%)`;
};

export const runnerTheme: Theme = {
  name: 'dusk run',
  // Every colour is a token of the look (kit/shell/src/tokens.ts).
  palette: {
    background: '#0c0919',
    surface: '#33285c',
    primary: '#7c63d9',
    secondary: '#ff8a1f',
    accent: '#efe7d2',
    text: '#efe7d2',
    muted: '#b7a1ff',
    danger: '#ff8a1f',
  },
  buttonRadius: 6,
  typeScale: { small: 14, body: 17, title: 38 },
  signature: 'notch',
  // A small moon in the top right corner of the menu card, the moon of the play scene: a pale disc with
  // two halo rings and three craters.
  cardArt: [
    disc(-4, -3, '#b9c02a8c', 2.1),
    disc(3, 3, '#b9c02a8c', 1.6),
    disc(-1, 5, '#b9c02a8c', 1),
    disc(0, 0, '#f2f6a0', 9.5),
    disc(0, 0, '#e8f04a2e', 12),
    disc(0, 0, '#e8f04a1a', 15.5),
  ].join(', '),
  // The sky of the title screen: the violet of the witch, soft.
  glow: '#7c63d940',
  // The scene of the course draws its own moon, so the play screen adds none.
  sceneMoon: true,
  titleArt: { wide: wideArt(), narrow: narrowArt() },
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
