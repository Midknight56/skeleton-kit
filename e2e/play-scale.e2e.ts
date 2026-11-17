import type { Page } from '@playwright/test';
import { FRAME_MS, control, expect, freezeClock, installClock, screen, test } from './fixtures';

// The play screen scales with the window like the menus do, and the runner fits a tall screen by height.
// Everything is measured in a real browser: button boxes and computed text size from the page, the
// counter text from the white pixels of the canvas, and the rider and tiles from the scene boxes
// that the canvas publishes.

interface Box { x: number; y: number; w: number; h: number }

async function scene(page: Page): Promise<{ canvas: Box; items: (Box & { id: string })[] }> {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-screen="play"] canvas') as HTMLCanvasElement;
    const c = canvas.getBoundingClientRect();
    const items = JSON.parse(canvas.getAttribute('data-scene') ?? '[]') as (Box & { id: string })[];
    return { canvas: { x: c.left, y: c.top, w: c.width, h: c.height }, items };
  });
}

// The height in CSS px of the pure white pixels of the canvas: the counter text.
async function counterHeight(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-screen="play"] canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255 && data[i + 3] === 255) {
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y + 1);
        }
      }
    }
    return maxY < 0 ? 0 : ((maxY - minY) * canvas.getBoundingClientRect().height) / canvas.height;
  });
}

test('garden play screen at 1920x1080: the Wait button, the chips and the turn line are big', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/garden/');
  await control(page, 'play').click();
  await expect(screen(page, 'play')).toBeVisible();
  await expect(page.locator('[data-hint]').first()).toBeVisible();
  await expect(page.locator('[data-screen="play"] canvas')).toHaveAttribute('data-scene', /"id":/);
  const wait = await control(page, 'wait').boundingBox();
  expect(wait!.height, 'Wait button height').toBeGreaterThanOrEqual(64);
  for (const id of ['pause', 'undo']) {
    const b = await control(page, id).boundingBox();
    expect(b!.height, `${id} height`).toBeGreaterThanOrEqual(64);
    expect(b!.width, `${id} width`).toBeGreaterThanOrEqual(64);
  }
  const chipSizes = await page.locator('[data-hint]').evaluateAll((els) => els.map((el) => Number.parseFloat(getComputedStyle(el).fontSize)));
  expect(chipSizes.length).toBeGreaterThan(0);
  for (const size of chipSizes) expect(size, 'chip text size').toBeGreaterThanOrEqual(20);
  expect(await counterHeight(page), 'the turn line, as ink height').toBeGreaterThanOrEqual(32);
});

test('garden play screen at 360x640: the buttons keep their small size', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/garden/');
  await control(page, 'play').click();
  await expect(screen(page, 'play')).toBeVisible();
  const wait = await control(page, 'wait').boundingBox();
  expect(wait!.height).toBe(44);
  expect(640 - (wait!.y + wait!.height)).toBe(16);
});

async function openRunner(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await installClock(page);
  await page.goto('/runner/');
  await freezeClock(page);
  await control(page, 'play').click();
  await expect(screen(page, 'play')).toBeVisible();
  await page.clock.runFor(2 * FRAME_MS);
  await expect(page.locator('[data-screen="play"] canvas')).toHaveAttribute('data-scene', /"id":"player"/);
}

test('runner at 360x640: the rider is 40 px tall and 5 tiles of course lie right of it', async ({ page }) => {
  await openRunner(page, 360, 640);
  const { canvas, items } = await scene(page);
  const player = items.find((i) => i.id === 'player')!;
  expect(player.h, 'rider height').toBeGreaterThanOrEqual(40);
  const ground = items.filter((i) => i.id.startsWith('ground-'));
  expect(ground.length).toBeGreaterThan(0);
  const tile = ground[0]!.w;
  expect((canvas.w - (player.x + player.w)) / tile, 'tiles right of the rider').toBeGreaterThanOrEqual(5);
  expect(canvas.w / tile, 'tiles across').toBeLessThan(10);
});

test('runner at 1920x1080: the rider is as tall as before, about 112 px', async ({ page }) => {
  await openRunner(page, 1920, 1080);
  const { items } = await scene(page);
  const player = items.find((i) => i.id === 'player')!;
  expect(player.h).toBeGreaterThanOrEqual(112 * 0.9);
  expect(player.h).toBeLessThanOrEqual(112 * 1.1);
  expect(await counterHeight(page), 'the score, as ink height').toBeGreaterThanOrEqual(32);
});
