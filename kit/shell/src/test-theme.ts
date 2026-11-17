// A neutral theme for the tests of this package.
import type { SoundRecipe, Theme } from './theme';

const recipe: SoundRecipe = { wave: 'sine', notes: [{ hz: 440, ms: 80 }], gain: 0.2 };

export function neutralTheme(over: Partial<Theme['palette']> = {}): Theme {
  return {
    name: 'neutral',
    palette: {
      background: '#101830',
      surface: '#1c2a4a',
      primary: '#ff7a00',
      secondary: '#00a3ff',
      accent: '#ffd400',
      text: '#ffffff',
      muted: '#a8b4d0',
      danger: '#ff3355',
      ...over,
    },
    buttonRadius: 8,
    typeScale: { small: 14, body: 18, title: 32 },
    signature: 'leaf',
    sprites: {},
    sounds: { tap: recipe, move: recipe, win: recipe, lose: recipe, pickup: recipe },
    music: recipe,
  };
}
