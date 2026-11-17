import type { SoundRecipe, Theme } from '@kit/shell';

// The sprites are hand-written SVG files in assets/, drawn for this project with the palette below.
// Each file is small, so the build inlines it and the page loads no extra file for it.
import flower from './assets/flower.svg';
import ground from './assets/ground.svg';
import hedge from './assets/hedge.svg';
import lantern from './assets/lantern.svg';
import lanternLit from './assets/lantern_lit.svg';
import moth from './assets/moth.svg';
import mothCaught from './assets/moth_caught.svg';
import mothHome from './assets/moth_home.svg';
import web from './assets/web.svg';
import { garlandLit, garlandUnlit, narrowArt, wideArt } from './src/view/puppets';

const sprites: Record<string, string> = {
  hedge,
  web,
  flower,
  ground,
  lantern,
  lantern_lit: lanternLit,
  moth,
  moth_caught: mothCaught,
  moth_home: mothHome,
};

const sound = (wave: SoundRecipe['wave'], gain: number, ...notes: [number, number][]): SoundRecipe => ({
  wave,
  gain,
  notes: notes.map(([hz, ms]) => ({ hz, ms })),
});

export const gardenTheme: Theme = {
  name: 'night garden',
  // Every colour is a token of the look (kit/shell/src/tokens.ts).
  palette: {
    background: '#141026',
    surface: '#221a3d',
    primary: '#ff8a1f',
    secondary: '#b7a1ff',
    accent: '#ff6fb5',
    text: '#efe7d2',
    muted: '#b5abcf',
    danger: '#ff6fb5',
  },
  buttonRadius: 24,
  typeScale: { small: 14, body: 18, title: 34 },
  signature: 'leaf',
  // A soft lantern glow at the top of the menu card: the warm core and the amber of the lit lantern sprite.
  cardArt:
    'radial-gradient(ellipse 85% 60% at 50% 0%, #fff3c433 0%, #ffb62724 40%, #ffb62700 100%), ' +
    'radial-gradient(ellipse 45% 28% at 50% 0%, #fff3c44d 0%, #fff3c400 100%)',
  // The sky of the title screen glows with the lit lantern.
  glow: '#ff8a1f4d',
  titleArt: { wide: wideArt(), narrow: narrowArt() },
  garland: { lit: garlandLit, unlit: garlandUnlit },
  sprites,
  sounds: {
    tap: sound('sine', 0.15, [660, 50]),
    move: sound('triangle', 0.15, [392, 70], [494, 70]),
    win: sound('triangle', 0.2, [523, 120], [659, 120], [784, 200]),
    lose: sound('sawtooth', 0.12, [330, 160], [247, 260]),
    pickup: sound('square', 0.1, [880, 60], [1175, 80]),
  },
  music: sound('sine', 0.04, [262, 400], [330, 400], [392, 400], [330, 400], [294, 400], [349, 400], [440, 400], [349, 400]),
};
