import type { Page } from '@playwright/test';
import { FRAME_MS, control, expect, freezeClock, installClock, screen, test } from './fixtures';

// The play screen at the seven layout viewports, measured in a real browser:
//   (a) the board is centred in the play area, within one tile;
//   (b) each lesson chip touches its anchor or sits within 12 px of it, and is never inside the
//       top bar or the bottom control strip;
//   (c) no chip is within 12 px of the counter text or of any button.
// The chip that points at a button is the one case where (b) and (c) meet: it sits exactly 12 px
// from that button, so the 12 px limits are checked with no slack.

const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];

interface Box { x: number; y: number; w: number; h: number }
interface Item extends Box { id: string }

interface Measured {
  canvas: Box;
  items: Item[];
  chips: Item[];
  buttons: Item[];
  strip: Box;
  // The bounding box of the pure white pixels of the canvas: the counter text. Null when there is none.
  text: Box | null;
}

async function measure(page: Page): Promise<Measured> {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-screen="play"] canvas') as HTMLCanvasElement;
    const c = canvas.getBoundingClientRect();
    const items = (JSON.parse(canvas.getAttribute('data-scene') ?? '[]') as { id: string; x: number; y: number; w: number; h: number }[]).map((b) => ({
      id: b.id,
      x: c.left + b.x,
      y: c.top + b.y,
      w: b.w,
      h: b.h,
    }));
    const rects = (selector: string, attr: string): { id: string; x: number; y: number; w: number; h: number }[] =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)).map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.getAttribute(attr) ?? '', x: r.left, y: r.top, w: r.width, h: r.height };
      });
    const s = (document.querySelector('[data-strip="play"]') as HTMLElement).getBoundingClientRect();
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const sx = c.width / canvas.width;
    const sy = c.height / canvas.height;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255 && data[i + 3] === 255) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + 1);
          maxY = Math.max(maxY, y + 1);
        }
      }
    }
    return {
      canvas: { x: c.left, y: c.top, w: c.width, h: c.height },
      items,
      chips: rects('[data-hint]', 'data-hint'),
      buttons: rects('[data-screen="play"] [data-control]', 'data-control'),
      strip: { x: s.left, y: s.top, w: s.width, h: s.height },
      text: maxX < 0 ? null : { x: c.left + minX * sx, y: c.top + minY * sy, w: (maxX - minX) * sx, h: (maxY - minY) * sy },
    };
  });
}

function gap(a: Box, b: Box): number {
  const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0);
  const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
  return Math.hypot(dx, dy);
}

const GAMES = [
  {
    name: 'garden',
    // The lesson anchors of the garden puzzle, by chip id.
    anchors: { 'tap-lantern': 'lantern-1', 'wait-turn': 'wait', 'switch-lantern': 'lantern-2' } as Record<string, string>,
    async open(page: Page): Promise<void> {
      await page.goto('/garden/');
    },
    async afterPlayStart(): Promise<void> {},
  },
  {
    name: 'runner',
    anchors: { jump: 'player' } as Record<string, string>,
    async open(page: Page): Promise<void> {
      await installClock(page);
      await page.goto('/runner/');
      await freezeClock(page);
    },
    async afterPlayStart(page: Page): Promise<void> {
      await page.clock.runFor(2 * FRAME_MS);
    },
  },
];

for (const game of GAMES) {
  for (const viewport of VIEWPORTS) {
    test(`${game.name} play screen layout at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await game.open(page);
      await expect(control(page, 'watch')).toBeVisible();
      await control(page, 'play').click();
      await expect(screen(page, 'play')).toBeVisible();
      await game.afterPlayStart(page);
      await expect(page.locator('[data-hint]').first()).toBeVisible();
      await expect(page.locator('[data-screen="play"] canvas')).toHaveAttribute('data-scene', /"id":/);
      const m = await measure(page);
      const problems: string[] = [];

      // (a) The bounding box of the board items, centred in the play area within one tile.
      const board = m.items.filter((i) => i.id !== 'glow');
      const left = Math.min(...board.map((i) => i.x));
      const top = Math.min(...board.map((i) => i.y));
      const right = Math.max(...board.map((i) => i.x + i.w));
      const bottom = Math.max(...board.map((i) => i.y + i.h));
      const widths = board.map((i) => i.w).sort((p, q) => p - q);
      const tile = widths[Math.floor(widths.length / 2)]!;
      const offX = (left + right) / 2 - (m.canvas.x + m.canvas.w / 2);
      const offY = (top + bottom) / 2 - (m.canvas.y + m.canvas.h / 2);
      if (Math.abs(offX) > tile) problems.push(`board box ${left}..${right} is ${offX.toFixed(1)} px off the centre in x, one tile is ${tile}`);
      if (Math.abs(offY) > tile) problems.push(`board box ${top}..${bottom} is ${offY.toFixed(1)} px off the centre in y, one tile is ${tile}`);

      // (b) and (c) for each chip.
      const avoid: Item[] = [...m.buttons];
      if (m.text) avoid.push({ id: 'counter text', ...m.text });
      expect(m.chips.length, 'chips shown').toBeGreaterThan(0);
      for (const chip of m.chips) {
        const anchorId = game.anchors[chip.id];
        const anchor = anchorId ? (m.buttons.find((b) => b.id === anchorId) ?? m.items.find((i) => i.id === anchorId)) : undefined;
        const name = `chip ${chip.id}`;
        if (!anchor) {
          // The anchor has no box (a text item). It cannot be measured, so only (c) and the bars apply.
        } else if (gap(chip, anchor) > 12) {
          problems.push(`${name} is ${gap(chip, anchor).toFixed(1)} px from its anchor ${anchorId}, limit is 12`);
        }
        if (m.text && chip.y < m.text.y + m.text.h) problems.push(`${name} starts at y ${chip.y}, inside the top bar that ends at y ${m.text.y + m.text.h}`);
        if (chip.y + chip.h > m.strip.y) problems.push(`${name} ends at y ${chip.y + chip.h}, inside the control strip that starts at y ${m.strip.y}`);
        for (const other of avoid) {
          if (gap(chip, other) < 12) problems.push(`${name} is ${gap(chip, other).toFixed(1)} px from ${other.id}, minimum is 12`);
        }
      }
      expect(problems, `play layout at ${viewport.width}x${viewport.height}`).toEqual([]);
    });
  }
}
