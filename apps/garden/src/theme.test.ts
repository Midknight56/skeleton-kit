import { describe, expect, it } from 'vitest';
import type { Viewport } from '@kit/core';
import { checkTheme } from '@kit/shell';
import { gardenTheme } from '../theme';
import def from './def';

const viewport: Viewport = { width: 360, height: 568, safe: { top: 0, right: 0, bottom: 0, left: 0 } };

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('garden theme', () => {
  it('has no problem for checkTheme', () => {
    expect(checkTheme(gardenTheme)).toEqual([]);
  });

  it('has a soft lantern glow at the top of the menu card, in the lantern colours', () => {
    const art = gardenTheme.cardArt ?? '';
    expect(art).toMatch(/radial-gradient\(/);
    expect(art).toMatch(/at 50% 0%/);
    // The lit lantern sprite uses these two colours.
    expect(art.toLowerCase()).toContain('#ffb627');
    expect(art.toLowerCase()).toContain('#fff3c4');
    expect(art).not.toMatch(/url\(/);
  });

  it('has the leaf signature and a button radius', () => {
    expect(gardenTheme.signature).toBe('leaf');
    expect(gardenTheme.buttonRadius).toBeGreaterThan(0);
  });

  it('names every sprite the scene uses', () => {
    const names = ['hedge', 'web', 'flower', 'lantern', 'lantern_lit', 'moth', 'moth_caught', 'moth_home'];
    for (const name of names) expect(gardenTheme.sprites[name], name).toBeDefined();
    const used = new Set<string>();
    for (const level of def.levels()) {
      for (const item of def.view(def.init(level.id, 1), viewport).items) if (item.kind === 'sprite') used.add(item.sprite);
    }
    for (const name of used) expect(gardenTheme.sprites[name], `scene sprite ${name}`).toBeDefined();
  });

  it('has a recipe for each sound name and for the music', () => {
    for (const name of ['tap', 'move', 'win', 'lose', 'pickup'] as const) {
      expect(gardenTheme.sounds[name].notes.length, name).toBeGreaterThan(0);
    }
    expect(gardenTheme.music.notes.length).toBeGreaterThan(0);
  });

  it('loads no image from another site', () => {
    for (const url of Object.values(gardenTheme.sprites)) expect(url).not.toMatch(/^(https?:)?\/\//);
  });
});

describe('garden scene text on the theme background', () => {
  const scene = def.view(def.init('g01', 1), viewport);

  it('draws the hud-turn text in white', () => {
    const item = scene.items.find((i) => i.id === 'hud-turn');
    expect(item?.kind).toBe('text');
    expect(item && item.kind === 'text' ? item.fill : '').toBe('#ffffff');
  });

  it('has a contrast of at least 4.5 for every text item of the first scene of g01', () => {
    const texts = scene.items.filter((i) => i.kind === 'text');
    expect(texts.length).toBeGreaterThan(0);
    for (const item of texts) {
      if (item.kind !== 'text') continue;
      expect(contrast(item.fill, gardenTheme.palette.background), item.id).toBeGreaterThanOrEqual(4.5);
    }
  });
});
