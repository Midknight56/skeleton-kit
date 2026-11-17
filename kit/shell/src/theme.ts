export type SoundName = 'tap' | 'move' | 'win' | 'lose' | 'pickup';
export interface SoundRecipe {
  wave: 'sine' | 'square' | 'triangle' | 'sawtooth';
  notes: { hz: number; ms: number }[];
  gain: number;
}

export interface Theme {
  name: string;
  palette: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    muted: string;
    danger: string;
  };
  buttonRadius: number;
  typeScale: { small: number; body: number; title: number };
  signature: 'leaf' | 'star' | 'notch' | 'wave';
  // Optional art of the menu card: one or more CSS background layers (gradients), painted over the card
  // colour. Sizes and places use var(--u), the size of one px of the menu screens. No url(). A game that
  // leaves it out gets a plain card.
  cardArt?: string;
  // Optional puppets of the title screen: two inline SVG pictures, one for wide screens (viewBox
  // 0 0 1920 1080, anchored top right) and one for narrow screens (viewBox 0 0 360 640, anchored top
  // centre). Strings run up to the rail. Plain shapes only: no script, image, event handler or url that
  // leaves the page.
  titleArt?: { wide: string; narrow: string };
  // Optional picture of the level garland on the title screen: the SVG of one level, lit and unlit
  // (viewBox 0 0 34 50).
  garland?: { lit: string; unlit: string };
  // True when the scene of the game draws its own moon, so the play screen shows no second one.
  sceneMoon?: boolean;
  // Optional soft light of the sky, a '#rrggbb' or '#rrggbbaa' colour. Default is a violet from the tokens.
  glow?: string;
  sprites: Record<string, string>;
  sounds: Record<SoundName, SoundRecipe>;
  music: SoundRecipe;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
// A reference to a part of the same picture (url(#id), href="#id") is fine. Anything else is not.
const UNSAFE_ART = /<\s*(script|image|foreignObject|iframe|style)\b|\son[a-z]+\s*=|javascript:|url\(\s*["']?(?!#)|href\s*=\s*["'](?!#)/i;

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG contrast ratio of two '#rrggbb' colours.
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// HSL saturation from 0 to 1 of a '#rrggbb' colour.
export function saturation(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  const lightness = (max + min) / 2;
  return delta / (1 - Math.abs(2 * lightness - 1));
}

// Returns one line for each saturation or contrast problem. An empty list means the theme passes.
export function checkTheme(theme: Theme): string[] {
  const problems: string[] = [];
  for (const [name, value] of Object.entries(theme.palette)) {
    if (!HEX.test(value)) problems.push(`palette.${name} is "${value}", not #rrggbb`);
  }
  if (theme.cardArt !== undefined && /url\(|[{};@]|\\/.test(theme.cardArt)) {
    problems.push('cardArt must be CSS background layers only: no url(), braces, semicolon, at-rule or backslash');
  }
  const arts: [string, string | undefined][] = [
    ['titleArt.wide', theme.titleArt?.wide],
    ['titleArt.narrow', theme.titleArt?.narrow],
    ['garland.lit', theme.garland?.lit],
    ['garland.unlit', theme.garland?.unlit],
  ];
  for (const [name, art] of arts) {
    if (art === undefined) continue;
    if (!/^\s*<svg[\s>]/.test(art)) problems.push(`${name} must be one inline svg`);
    if (UNSAFE_ART.test(art)) problems.push(`${name} must hold plain shapes only: no script, image, event handler or link that leaves the page`);
  }
  if (problems.length > 0) return problems;
  const { palette } = theme;
  for (const name of ['primary', 'secondary'] as const) {
    const s = saturation(palette[name]);
    if (s < 0.25) problems.push(`palette.${name} ${palette[name]} has saturation ${s.toFixed(2)}, below 0.25`);
  }
  const ratio = contrastRatio(palette.text, palette.background);
  if (ratio < 4.5) {
    problems.push(`palette.text ${palette.text} on background ${palette.background} has contrast ${ratio.toFixed(2)}, below 4.5`);
  }
  return problems;
}
