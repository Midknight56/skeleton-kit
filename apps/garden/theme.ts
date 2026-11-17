import type { SoundRecipe, Theme } from '@kit/shell';

// First pick of colours, shapes and sounds. The sprites are plain shapes drawn for this project as
// inline pictures, so the page loads no file for them. Final art can replace them later.
function picture(body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const sprites: Record<string, string> = {
  hedge: picture('<rect x="1" y="1" width="30" height="30" rx="8" fill="#1f6b3a"/><circle cx="9" cy="10" r="5" fill="#2e8f50"/><circle cx="21" cy="20" r="6" fill="#2e8f50"/>'),
  web: picture('<g stroke="#e8e6f5" stroke-width="1.5" fill="none"><path d="M16 2V30M2 16H30M5 5L27 27M27 5L5 27"/><circle cx="16" cy="16" r="5"/><circle cx="16" cy="16" r="10"/></g>'),
  flower: picture('<g fill="#ff6f91"><circle cx="16" cy="7" r="6"/><circle cx="16" cy="25" r="6"/><circle cx="7" cy="16" r="6"/><circle cx="25" cy="16" r="6"/></g><circle cx="16" cy="16" r="5" fill="#ffd23f"/>'),
  lantern: picture('<rect x="12" y="2" width="8" height="4" rx="2" fill="#8a7fb8"/><rect x="8" y="6" width="16" height="22" rx="5" fill="#3b3470" stroke="#8a7fb8" stroke-width="2"/><rect x="13" y="12" width="6" height="10" rx="3" fill="#6b63a0"/>'),
  lantern_lit: picture('<circle cx="16" cy="17" r="15" fill="#ffb627" opacity="0.35"/><rect x="12" y="2" width="8" height="4" rx="2" fill="#8a7fb8"/><rect x="8" y="6" width="16" height="22" rx="5" fill="#ffb627" stroke="#fff3c4" stroke-width="2"/><rect x="13" y="12" width="6" height="10" rx="3" fill="#fff3c4"/>'),
  moth: picture('<ellipse cx="9" cy="14" rx="8" ry="11" fill="#d9c7ff"/><ellipse cx="23" cy="14" rx="8" ry="11" fill="#d9c7ff"/><rect x="14" y="6" width="4" height="20" rx="2" fill="#6b4fa0"/>'),
  moth_caught: picture('<ellipse cx="9" cy="14" rx="8" ry="11" fill="#8a8aa0"/><ellipse cx="23" cy="14" rx="8" ry="11" fill="#8a8aa0"/><rect x="14" y="6" width="4" height="20" rx="2" fill="#4a4a60"/><path d="M4 4L28 28M28 4L4 28" stroke="#ff5a5f" stroke-width="3"/>'),
  moth_home: picture('<ellipse cx="9" cy="14" rx="8" ry="11" fill="#b9f5c4"/><ellipse cx="23" cy="14" rx="8" ry="11" fill="#b9f5c4"/><rect x="14" y="6" width="4" height="20" rx="2" fill="#2e8f50"/>'),
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
