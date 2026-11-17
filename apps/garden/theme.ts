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
  palette: {
    background: '#1b1636',
    surface: '#2c2457',
    primary: '#ffb627',
    secondary: '#7ed957',
    accent: '#ff6f91',
    text: '#ffffff',
    muted: '#b9b2d9',
    danger: '#ff5a5f',
  },
  buttonRadius: 24,
  typeScale: { small: 14, body: 18, title: 34 },
  signature: 'leaf',
  // A soft lantern glow at the top of the menu card: the warm core and the amber of the lit lantern sprite.
  cardArt:
    'radial-gradient(ellipse 85% 60% at 50% 0%, #fff3c433 0%, #ffb62724 40%, #ffb62700 100%), ' +
    'radial-gradient(ellipse 45% 28% at 50% 0%, #fff3c44d 0%, #fff3c400 100%)',
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
