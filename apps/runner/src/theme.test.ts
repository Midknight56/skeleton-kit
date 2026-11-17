import { describe, expect, it } from 'vitest';
import type { Viewport } from '@kit/core';
import { checkTheme } from '@kit/shell';
import { runnerTheme } from '../theme';
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

describe('runner theme', () => {
  it('has no problem for checkTheme', () => {
    expect(checkTheme(runnerTheme)).toEqual([]);
  });

  it('has a button radius and a signature shape', () => {
    expect(runnerTheme.buttonRadius).toBeGreaterThanOrEqual(0);
    expect(['leaf', 'star', 'notch', 'wave']).toContain(runnerTheme.signature);
  });

  it('names every sprite that the scene of every course uses', () => {
    const used = new Set<string>();
    for (const level of def.levels()) {
      for (const item of def.view(def.init(level.id, 1), viewport).items) if (item.kind === 'sprite') used.add(item.sprite);
    }
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) expect(runnerTheme.sprites[name], `scene sprite ${name}`).toBeDefined();
  });

  it('has a recipe for each sound name and for the music', () => {
    for (const name of ['tap', 'move', 'win', 'lose', 'pickup'] as const) {
      expect(runnerTheme.sounds[name].notes.length, name).toBeGreaterThan(0);
    }
    expect(runnerTheme.music.notes.length).toBeGreaterThan(0);
  });

  it('loads no image from another site', () => {
    for (const url of Object.values(runnerTheme.sprites)) expect(url).not.toMatch(/^(https?:)?\/\//);
  });
});

describe('runner scene text on the theme background', () => {
  const scene = def.view(def.init('r01', 1), viewport);

  it('has a contrast of at least 4.5 for every text item of the first scene of r01', () => {
    const texts = scene.items.filter((i) => i.kind === 'text');
    expect(texts.length).toBeGreaterThan(0);
    for (const item of texts) {
      if (item.kind !== 'text') continue;
      expect(contrast(item.fill, runnerTheme.palette.background), item.id).toBeGreaterThanOrEqual(4.5);
    }
  });
});
