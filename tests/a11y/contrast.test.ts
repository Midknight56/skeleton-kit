import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { gardenTheme } from '../../apps/garden/theme';
import { runnerTheme } from '../../apps/runner/theme';
import { themeCss } from '../../kit/shell/src/styles';
import type { Theme } from '../../kit/shell/src/theme';

// Task 5 of .kiro/specs/accessibility-scan. axe lists color-contrast as incomplete on every screen,
// because the text sits on gradients and pictures. This test computes the WCAG 2.1 contrast ratio
// itself. It builds the page CSS of each theme with `themeCss`, reads the colour, size and weight of
// each text from the rules, and checks the text against the background it is drawn on.
//
// Sizes are read at `--u` of 1px, the smallest size of the menu screens, which is the worst case for the
// rule "normal text or large text". Limits: 4.5 for normal text, 3 for large text (24 px, or 18.66 px
// bold), for the borders of controls and for icons (WCAG 1.4.11).

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPORT = join(REPO, 'docs', 'acceptance', 'a11y', 'contrast.json');

type Rgb = [number, number, number];
type Rgba = [number, number, number, number];

// ---------- the WCAG 2.1 formula ----------

// Relative luminance of WCAG 2.1: each channel goes from sRGB to linear light, then 0.2126 R + 0.7152 G + 0.0722 B.
export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ---------- colours and CSS values ----------

function parseColour(text: string): Rgba {
  const hex = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(text);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, hex[2] ? parseInt(hex[2], 16) / 255 : 1];
  }
  const fn = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+))?\s*\)$/.exec(text);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3]), fn[4] === undefined ? 1 : Number(fn[4])];
  throw new Error(`not a colour: ${text}`);
}

const COLOUR = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|rgb\([^)]*\)/;

function firstColour(value: string): Rgba {
  const m = COLOUR.exec(value);
  if (!m) throw new Error(`no colour in: ${value}`);
  return parseColour(m[0]);
}

// `top` over `under`, both with alpha. The result is opaque when `under` is.
function over(top: Rgba, under: Rgba): Rgba {
  const a = top[3] + under[3] * (1 - top[3]);
  const mix = (i: 0 | 1 | 2): number => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a;
  return [mix(0), mix(1), mix(2), a];
}

const rgbOf = (c: Rgba): Rgb => [c[0], c[1], c[2]];
const hexOf = (c: Rgb): string => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

interface Rule { selector: string; body: string }

function rulesOf(css: string): Rule[] {
  const rules: Rule[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) rules.push({ selector: m[1]!.trim().replace(/\s+/g, ' '), body: m[2]! });
  return rules;
}

// The value of one property in the last rule with exactly this selector that sets it. The rules of
// the look come after the base rules, so the last one wins, as in the browser for equal specificity.
function declared(rules: Rule[], selector: string, property: string): string | undefined {
  const pattern = new RegExp(`(?:^|[;\\s])${property}\\s*:\\s*([^;]+)`);
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i]!;
    if (rule.selector !== selector) continue;
    const m = pattern.exec(rule.body);
    if (m) return m[1]!.trim();
  }
  return undefined;
}

function need(rules: Rule[], selector: string, property: string): string {
  const value = declared(rules, selector, property);
  if (value === undefined) throw new Error(`the CSS has no "${property}" in a rule "${selector}"`);
  return value;
}

// A size in px at `--u` of 1px. The shell writes sizes as `calc(18 * var(--u))`, as
// `calc(14px + 10 * (var(--u) - 1px))`, as `clamp(44px, ...)` or as `14px`.
function pixels(value: string): number {
  const m = /^(?:calc\()?(\d+(?:\.\d+)?)(?:px)?\b|^clamp\((\d+(?:\.\d+)?)px/.exec(value);
  if (!m) throw new Error(`not a size: ${value}`);
  return Number(m[1] ?? m[2]);
}

// ---------- the sky ----------

// The sky is a fixed gradient: a soft radial glow over a linear gradient from night to dusk. Its
// lightest area is found by painting it in a model: for each pixel of a viewport, the radial glow (alpha
// falls from its own alpha at the centre to 0 at the transparent stop) is laid over the linear colour
// of that row. The lightest pixel over three viewport sizes is the background for light text.
function lightestSky(rules: Rule[]): Rgb {
  const value = need(rules, '[data-backdrop]', 'background');
  const radial = /radial-gradient\(ellipse (\d+)px (\d+)px at (\d+)% (\d+)%, (#[0-9a-fA-F]{6,8}) 0, transparent (\d+)%\)/.exec(value);
  const linear = /linear-gradient\((#[0-9a-fA-F]{6}) 0, (#[0-9a-fA-F]{6}) (\d+)%, (#[0-9a-fA-F]{6}) 100%\)/.exec(value);
  if (!radial || !linear) throw new Error(`the sky rule has a form this test does not read: ${value}`);
  const [rx, ry, cx, cy, edge] = [Number(radial[1]), Number(radial[2]), Number(radial[3]) / 100, Number(radial[4]) / 100, Number(radial[6]) / 100];
  const glow = parseColour(radial[5]!);
  const stops: [number, Rgb][] = [
    [0, rgbOf(parseColour(linear[1]!))],
    [Number(linear[3]) / 100, rgbOf(parseColour(linear[2]!))],
    [1, rgbOf(parseColour(linear[4]!))],
  ];
  const linearAt = (t: number): Rgb => {
    for (let i = 1; i < stops.length; i++) {
      const [t1, c1] = stops[i]!;
      const [t0, c0] = stops[i - 1]!;
      if (t <= t1) {
        const f = (t - t0) / (t1 - t0);
        return [0, 1, 2].map((k) => c0[k]! + (c1[k]! - c0[k]!) * f) as Rgb;
      }
    }
    return stops[2]![1];
  };
  let best: Rgb = [0, 0, 0];
  let bestLum = -1;
  const look = (x: number, y: number, w: number, h: number): void => {
    const d = Math.hypot((x - cx * w) / rx, (y - cy * h) / ry);
    const alpha = d >= edge ? 0 : glow[3] * (1 - d / edge);
    const pixel = rgbOf(over([glow[0], glow[1], glow[2], alpha], [...linearAt(y / h), 1]));
    const lum = relativeLuminance(pixel);
    if (lum > bestLum) {
      bestLum = lum;
      best = pixel;
    }
  };
  for (const [w, h] of [[360, 640], [768, 1024], [1920, 1080]] as const) {
    for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) look(x, y, w, h);
    // The centre of the glow itself, where it is strongest, whatever the grid step.
    look(cx * w, cy * h, w, h);
  }
  return best;
}

// The card of the confirm box is the only menu card that keeps its own background (the screens set
// `background: transparent`). It is the mix of surface and background, with the art of the theme over it.
// A layer of the art placed at the top centre is read at the top edge of the first line of text, the
// lightest point of the text on the centre line. Text starts 56 px below the top of the card, and the
// card is taller than that: a throwaway browser probe on this run measured 216 px (garden) and 215 px
// (runner) at 360 x 640 with the one line message. The test uses 240 px, a margin of about 10 percent for
// a longer message. A taller card only makes the layers reach lower, so 240 errs on the light side.
// The ratio of text top to card height stays the same when `--u` grows (probe: 113 of 429 px at 1920 x 1080).
// Layers placed at the top right corner (the moon of the runner) sit above the text: the lowest edge of
// the moon halo is 34 + 15.5 = 49.5 px from the top, and the text starts at 56 px.
const CARD_HEIGHT = 240;
const TEXT_TOP = 56;

function gradientAt(layer: string, y: number): Rgba | null {
  const size = /ellipse (\d+)% (\d+)% at 50% 0%/.exec(layer);
  if (!size) return null;
  const stops = [...layer.matchAll(/(#[0-9a-fA-F]{8}) (\d+)%/g)].map((m) => ({ at: Number(m[2]) / 100, colour: parseColour(m[1]!) }));
  const t = y / ((Number(size[2]) / 100) * CARD_HEIGHT);
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    if (t <= b.at) {
      const f = (t - a.at) / (b.at - a.at);
      return [0, 1, 2, 3].map((k) => a.colour[k]! + (b.colour[k]! - a.colour[k]!) * f) as Rgba;
    }
  }
  return [0, 0, 0, 0];
}

function confirmCard(rules: Rule[], theme: Theme): Rgb {
  const mix = /color-mix\(in srgb, (#[0-9a-fA-F]{6}) (\d+)%, (#[0-9a-fA-F]{6})\)/.exec(need(rules, '[data-card]', 'background'));
  if (!mix) throw new Error('the card background has a form this test does not read');
  const share = Number(mix[2]) / 100;
  const a = parseColour(mix[1]!);
  const b = parseColour(mix[3]!);
  let colour: Rgba = [0, 1, 2].map((i) => a[i]! * share + b[i]! * (1 - share)).concat(1) as Rgba;
  // The first layer of the art is the top one, so the layers are laid over the card from the last to the first.
  const layers = (theme.cardArt ?? '').split(/(?<=\)), (?=radial-gradient)/);
  for (const layer of layers.reverse()) {
    const at = gradientAt(layer, TEXT_TOP);
    if (at) colour = over(at, colour);
  }
  return rgbOf(colour);
}

// ---------- the pairs ----------

interface Pair {
  name: string;
  foreground: string;
  background: string;
  size: string;
  ratio: number;
  limit: number;
  result: 'pass' | 'fail';
}

function judge(name: string, fg: Rgb, bg: Rgb, size: string, limit: number): Pair {
  const ratio = contrast(fg, bg);
  return { name, foreground: hexOf(fg), background: hexOf(bg), size, ratio: Math.floor(ratio * 100) / 100, limit, result: ratio >= limit ? 'pass' : 'fail' };
}

// Large text: 24 px or more, or 18.66 px or more in bold (weight 700 and up).
function textLimit(px: number, weight: number): { limit: number; size: string } {
  const large = px >= 24 || (px >= 18.66 && weight >= 700);
  return { limit: large ? 3 : 4.5, size: `${px}px weight ${weight}, ${large ? 'large' : 'normal'} text` };
}

interface TextSpec {
  name: string;
  // The selector whose `color` is used. Null means the text takes the colour of `html, body`.
  colour: string | null;
  // The selector whose `font-size` is used, or a number of px.
  size: string | number;
  // The selector whose `font-weight` is used. Null means normal (400).
  weight: string | null;
  background: Rgb;
}

function pairsOf(game: string, theme: Theme): Pair[] {
  const rules = rulesOf(themeCss(theme));
  const pairs: Pair[] = [];
  const add = (p: Pair): number => pairs.push({ ...p, name: `${game}: ${p.name}` });

  const sky = lightestSky(rules);
  // The strip under the play controls is a dark veil over the sky.
  const strip = rgbOf(over(firstColour(need(rules, '[data-strip]', 'background')), [...sky, 1]));
  const card = confirmCard(rules, theme);
  const colourOf = (selector: string | null): Rgb => rgbOf(firstColour(need(rules, selector ?? 'html, body', 'color')));
  const backgroundOf = (selector: string): Rgb => rgbOf(firstColour(need(rules, selector, 'background')));

  const text = (s: TextSpec): void => {
    const px = typeof s.size === 'number' ? s.size : pixels(need(rules, s.size, 'font-size'));
    const weight = s.weight === null ? 400 : Number(need(rules, s.weight, 'font-weight'));
    const { limit, size } = textLimit(px, weight);
    add(judge(s.name, colourOf(s.colour), s.background, size, limit));
  };

  // A button takes its size from the screen (`font: inherit`) and its colours from the look.
  const BUTTON = 'button, a[data-control]';
  const plum = backgroundOf(BUTTON);

  // Text on the sky (menu cards are transparent, so the page sky is the background).
  text({ name: 'heading on the sky', colour: 'h1, h2', size: 'h1, h2', weight: 'h1, h2', background: sky });
  text({ name: 'title heading on the sky', colour: 'h1, h2', size: '[data-screen="title"] h1', weight: 'h1, h2', background: sky });
  text({ name: 'paragraph and list text on the sky', colour: null, size: 'p, li', weight: null, background: sky });
  text({ name: 'title tagline on the sky', colour: '[data-screen="title"] p', size: '[data-screen="title"] p', weight: null, background: sky });
  text({ name: 'storage notice on the sky', colour: '[data-screen="title"] p[data-notice]', size: '[data-screen="title"] p[data-notice]', weight: null, background: sky });
  text({ name: 'result reason on the sky', colour: '[data-reason]', size: '[data-reason]', weight: null, background: sky });
  text({ name: 'watch proof line on the sky', colour: '[data-proof="line"]', size: theme.typeScale.body, weight: '[data-proof="line"]', background: sky });

  // Controls: the label on the fill of the control.
  text({ name: 'button label on its fill', colour: BUTTON, size: '[data-screen]', weight: BUTTON, background: plum });
  text({ name: 'title button label on its fill', colour: BUTTON, size: '[data-screen="title"] [data-control]', weight: BUTTON, background: plum });
  text({ name: 'title play button label', colour: '[data-screen="title"] [data-control="play"]', size: '[data-screen="title"] [data-control="play"]', weight: BUTTON, background: backgroundOf('[data-screen="title"] [data-control="play"]') });
  text({ name: 'pressed or primary button label', colour: 'button[aria-pressed="true"], button.primary', size: '[data-screen]', weight: BUTTON, background: backgroundOf('button[aria-pressed="true"], button.primary') });
  text({ name: 'watch button label', colour: '[data-control="watch"]', size: '[data-screen="title"] [data-control]', weight: BUTTON, background: backgroundOf('[data-control="watch"]') });
  // A locked level is an inactive control and WCAG 1.4.3 exempts it. It is tested at full strength
  // anyway: the opacity of 0.5 that the shell adds is not applied here.
  text({ name: 'locked level tile label on its fill', colour: '.tiles button[data-locked="true"]', size: '[data-screen]', weight: BUTTON, background: backgroundOf('.tiles button[data-locked="true"]') });
  text({ name: 'hint chip label on its fill', colour: '[data-hint]', size: '[data-hint]', weight: '[data-hint]', background: backgroundOf('[data-hint]') });

  // The garland of the title screen: text on a dark panel of its own.
  const garland = backgroundOf('[data-garland]');
  text({ name: 'garland level number on the garland panel', colour: '[data-garland] .number', size: '[data-garland] .number', weight: null, background: garland });
  text({ name: 'garland note on the garland panel', colour: '[data-garland] .note', size: '[data-garland] .note', weight: null, background: garland });

  // The confirm box: its card keeps the card background.
  text({ name: 'confirm box message on its card', colour: null, size: 'p, li', weight: null, background: card });

  // Icons and borders of controls (limit 3).
  const ICON = 3;
  add(judge('pause and undo icons on their fill', colourOf(BUTTON), plum, 'icon', ICON));
  add(judge('level tile stars on their fill', colourOf(BUTTON), plum, 'icon', ICON));
  add(judge('locked level tile stars on their fill', colourOf('.tiles button[data-locked="true"]'), backgroundOf('.tiles button[data-locked="true"]'), 'icon', ICON));
  const outline = rgbOf(firstColour(need(rules, 'button:focus-visible, a[data-control]:focus-visible', 'outline')));
  add(judge('focus outline on the sky', outline, sky, 'border 3px', ICON));
  add(judge('focus outline on the play strip', outline, strip, 'border 3px', ICON));
  const watchBorder = rgbOf(firstColour(need(rules, '[data-control="watch"]', 'border')));
  add(judge('watch button border on the sky', watchBorder, sky, 'border 2px', ICON));
  add(judge('watch button border on its fill', watchBorder, backgroundOf('[data-control="watch"]'), 'border 2px', ICON));
  return pairs;
}

const NOT_COVERED = [
  'Text that the painter draws on the canvas (the labels of the play screen) is not covered. The painter in kit/shell/src/painter.ts has no text call, so no colour of it could be added. Any text a game draws inside its own scene is not covered.',
  'The watch proof line is tested against the page sky. What the game scene draws under that row of the canvas is not covered.',
  'The stars of the sky and the moon of the menu screens are not tested as backgrounds. The stars are 1 px dots. The moon sits in a corner and no rule keeps text off it.',
  'The title puppets are not tested as backgrounds. The shell hides every puppet that comes within 24 px of a heading, a paragraph or the menu column (backdrop.ts, keepClear).',
  'Buttons are tested for their label and icon. The edge of a plum button against the sky is not tested, because the label names the control. Disabled buttons and the opacity of a locked tile are not applied, because WCAG 1.4.3 exempts inactive controls.',
  'Sizes are read at the smallest size of the menu screens (--u of 1px). A larger screen only makes text bigger.',
  'The decorative card border, the strings and the garland pictures are not tested. They carry no information.',
  'A ratio is a calculation. It says nothing about how real users see the screen.',
];

const games: [string, Theme][] = [['garden', gardenTheme], ['runner', runnerTheme]];
const all = games.flatMap(([game, theme]) => pairsOf(game, theme));

describe('the WCAG 2.1 formula', () => {
  it('gives 21 for black on white and 1 for equal colours', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([120, 90, 200], [120, 90, 200])).toBeCloseTo(1, 5);
  });

  it('gives 4.54 for #767676 on white, a value known from the WCAG documents', () => {
    expect(contrast([0x76, 0x76, 0x76], [255, 255, 255])).toBeCloseTo(4.54, 2);
  });

  it('marks a pair under its limit as a fail', () => {
    expect(judge('same colour', [239, 231, 210], [239, 231, 210], 'x', 4.5).result).toBe('fail');
  });

  it('calls 18.66 px bold and 24 px large, and 18 px bold normal', () => {
    expect(textLimit(18.66, 700).limit).toBe(3);
    expect(textLimit(24, 400).limit).toBe(3);
    expect(textLimit(18, 700).limit).toBe(4.5);
    expect(textLimit(34, 400).limit).toBe(3);
  });
});

describe('contrast of the colours the shell uses', () => {
  it('lists every pair with its ratio and writes docs/acceptance/a11y/contrast.json', () => {
    const lowest = all.reduce((a, b) => (b.ratio < a.ratio ? b : a));
    const report = {
      tool: 'tests/a11y/contrast.test.ts, WCAG 2.1 relative luminance, no package',
      limits: { normalText: 4.5, largeTextAndControlBordersAndIcons: 3 },
      pairs: all.length,
      failing: all.filter((p) => p.result === 'fail').length,
      lowestRatio: { name: lowest.name, ratio: lowest.ratio },
      notCovered: NOT_COVERED,
      entries: all,
    };
    mkdirSync(dirname(REPORT), { recursive: true });
    writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8');
    for (const p of all) console.log(`${p.result.toUpperCase()}  ${p.ratio.toFixed(2).padStart(6)} (min ${p.limit})  ${p.name}  ${p.foreground} on ${p.background}  ${p.size}`);
    expect(all.length).toBeGreaterThan(30);
  });

  it('has no pair under its limit', () => {
    const failing = all.filter((p) => p.result === 'fail').map((p) => `${p.name}: ${p.foreground} on ${p.background} is ${p.ratio}, needs ${p.limit} (${p.size})`);
    expect(failing).toEqual([]);
  });
});
