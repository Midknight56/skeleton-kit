// @vitest-environment jsdom
import type { Viewport } from '@kit/core';
import { buttonWidth, playLayout, sceneBoxes, showHints, type Rect } from '@kit/shell';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { gardenTheme } from '../theme';
import gardenDef from './def';
import { gardenInput } from './input';
import levelsJson from './levels/levels.json';

// Every lesson chip of the garden puzzle, on every level, at every viewport of the layout test.
// A chip must sit at least 16 px inside the screen and the safe area, and must not overlap
// another chip. jsdom has no layout, so a stand-in gives each chip a size from its text:
// 0.7 em a letter (a browser measured about 0.6 em), 8 px padding at each side, 1.4 em line.
// The e2e layout test measures the same chips in a real browser.

const MARGIN = 16;
const SMALL = gardenTheme.typeScale.small;
const SCREENS: { name: string; width: number; height: number; safe: Viewport['safe'] }[] = [
  [360, 640],
  [375, 667],
  [390, 844],
  [412, 915],
  [768, 1024],
  [1280, 720],
  [1920, 1080],
].map(([width, height]) => ({ name: `${width}x${height}`, width: width!, height: height!, safe: { top: 0, right: 0, bottom: 0, left: 0 } }));
SCREENS.push({ name: '360x640 with safe insets', width: 360, height: 640, safe: { top: 24, right: 36, bottom: 34, left: 36 } });

beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement): DOMRect {
    const text = this.textContent ?? '';
    const w = Math.ceil(text.length * SMALL * 0.7) + 16;
    const h = Math.ceil(SMALL * 1.4) + 8;
    const x = parseFloat(this.style.left || '0');
    const y = parseFloat(this.style.top || '0');
    return { x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, toJSON: () => ({}) } as DOMRect;
  };
});
afterEach(() => {
  document.body.replaceChildren();
});

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function chipsFor(levelId: string, screen: (typeof SCREENS)[number]): { id: string; rect: Rect }[] {
  const state = gardenDef.init(levelId, 1);
  const strip = 72 + screen.safe.bottom;
  const viewport: Viewport = {
    width: screen.width,
    height: screen.height - strip,
    safe: { ...screen.safe, bottom: 0 },
  };
  const boxes = sceneBoxes(gardenDef.view(state, viewport));
  const layout = playLayout(screen.width, screen.height, screen.safe, [44, 44, buttonWidth('Wait', gardenTheme.typeScale.body)]);
  const wait = layout.controls[2]!;
  const root = document.createElement('div');
  document.body.append(root);
  const area = { width: screen.width, height: screen.height, safe: screen.safe, fontSize: SMALL };
  const boxFor = (anchor: string): Rect | null => {
    if (anchor === 'wait') return wait;
    const b = boxes.find((item) => item.id === anchor);
    return b ? { x: b.x, y: b.y, w: b.w, h: b.h } : null;
  };
  (showHints as (...args: unknown[]) => unknown)(document, root, gardenInput.lessons, boxFor, area);
  return Array.from(root.querySelectorAll<HTMLElement>('[data-hint]')).map((el) => {
    const r = el.getBoundingClientRect();
    return { id: el.dataset.hint as string, rect: { x: r.left, y: r.top, w: r.width, h: r.height } };
  });
}

describe('garden lesson chips', () => {
  for (const screen of SCREENS) {
    it(`sit 16 px inside the screen and do not overlap at ${screen.name}`, () => {
      const problems: string[] = [];
      let seen = 0;
      for (const level of levelsJson) {
        const chips = chipsFor(level.id, screen);
        seen += chips.length;
        const left = screen.safe.left + MARGIN;
        const top = screen.safe.top + MARGIN;
        const right = screen.width - screen.safe.right - MARGIN;
        const bottom = screen.height - screen.safe.bottom - MARGIN;
        for (const c of chips) {
          const name = `${level.id}: chip ${c.id}`;
          if (c.rect.x < left) problems.push(`${name} starts at x ${c.rect.x}, left limit is ${left}`);
          if (c.rect.y < top) problems.push(`${name} starts at y ${c.rect.y}, top limit is ${top}`);
          if (c.rect.x + c.rect.w > right) problems.push(`${name} ends at x ${c.rect.x + c.rect.w}, right limit is ${right}`);
          if (c.rect.y + c.rect.h > bottom) problems.push(`${name} ends at y ${c.rect.y + c.rect.h}, bottom limit is ${bottom}`);
        }
        for (let i = 0; i < chips.length; i++) {
          for (let j = i + 1; j < chips.length; j++) {
            if (overlaps(chips[i]!.rect, chips[j]!.rect)) problems.push(`${level.id}: chips ${chips[i]!.id} and ${chips[j]!.id} overlap`);
          }
        }
      }
      expect(seen, 'chips were measured').toBeGreaterThan(0);
      expect(problems).toEqual([]);
    });
  }

  it('keeps the text at its theme size', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const area = { width: 360, height: 640, safe: { top: 0, right: 0, bottom: 0, left: 0 }, fontSize: SMALL };
    (showHints as (...args: unknown[]) => unknown)(document, root, gardenInput.lessons, () => ({ x: 0, y: 200, w: 72, h: 72 }), area);
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-hint]'))) expect(el.style.fontSize).toBe('');
  });
});
