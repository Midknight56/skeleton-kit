import type { SoundRecipe, Theme } from '@kit/shell';

// First pick of colours, shapes and sounds. The sprites are plain shapes drawn for this project as
// inline pictures, so the page loads no file for them. Final art can replace them later.
function picture(body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const sprites: Record<string, string> = {
  ground: picture('<rect x="0" y="0" width="32" height="32" fill="#2b3a67"/><rect x="0" y="0" width="32" height="6" fill="#4d6bd6"/><path d="M4 14H12M18 22H28" stroke="#1d2e57" stroke-width="3"/>'),
  pumpkin: picture('<ellipse cx="16" cy="19" rx="14" ry="11" fill="#ff7a1a"/><path d="M16 8V28M9 10Q5 19 9 28M23 10Q27 19 23 28" stroke="#c24f00" stroke-width="2" fill="none"/><rect x="14" y="3" width="4" height="7" rx="2" fill="#35a853"/>'),
  post: picture('<rect x="9" y="0" width="14" height="32" fill="#6a4a2b"/><rect x="9" y="0" width="4" height="32" fill="#8a6540"/>'),
  gate: picture('<rect x="2" y="2" width="28" height="30" rx="2" fill="none" stroke="#e8f04a" stroke-width="4"/><path d="M10 4V32M22 4V32M3 12H29" stroke="#e8f04a" stroke-width="2.5"/>'),
  candle: picture('<ellipse cx="16" cy="8" rx="4" ry="6" fill="#ffd23f"/><rect x="11" y="12" width="10" height="18" rx="2" fill="#fff4d6"/>'),
  broom: picture('<rect x="1" y="14" width="20" height="4" rx="2" fill="#8a6540"/><path d="M20 10L31 8L31 24L20 22Z" fill="#e8c56a"/><circle cx="12" cy="9" r="5" fill="#35c2c9"/>'),
  broom_down: picture('<rect x="3" y="18" width="20" height="4" rx="2" fill="#8a6540" transform="rotate(25 13 20)"/><path d="M22 18L30 22L26 31L18 26Z" fill="#e8c56a"/><circle cx="9" cy="14" r="5" fill="#6b7aa8"/>'),
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
