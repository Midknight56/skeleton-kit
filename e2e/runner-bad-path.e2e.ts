import { FRAME_MS, control, expect, freezeClock, installClock, runUntilResults, screen, test } from './fixtures';
import type { Page } from '@playwright/test';

const KEY = 'kit.runner.v1';
const REASON = /^(Fell in a gap|Hit an obstacle)$/;

const seeded = JSON.stringify({
  version: 1,
  levels: { r01: { stars: 3, best: 1 }, r02: { stars: 2, best: 1 } },
  settings: { sound: true, music: true },
  lessons: {},
});

async function open(page: Page, seed = false): Promise<void> {
  if (seed) {
    await page.addInitScript(
      ([key, value]) => {
        if (!window.localStorage.getItem(key as string)) window.localStorage.setItem(key as string, value as string);
      },
      [KEY, seeded],
    );
  }
  await installClock(page);
  await page.goto('/runner/');
  await freezeClock(page);
}

test('runner: a player who never jumps loses with a reason, and retry starts again', async ({ page }) => {
  await open(page);
  await control(page, 'play').click();
  await runUntilResults(page);
  await expect(screen(page, 'results')).toHaveAttribute('data-phase', 'lost');
  await expect(page.locator('[data-reason]')).toHaveText(REASON);
  await expect(page.locator('[data-screen="results"] [data-stars]')).toHaveCount(0);
  await expect(control(page, 'next')).toHaveCount(0);

  await control(page, 'retry').click();
  await page.clock.runFor(2 * FRAME_MS);
  await expect(screen(page, 'play')).toHaveAttribute('data-tick', '0');
  await expect(screen(page, 'play')).toHaveAttribute('data-phase', 'playing');
});

test('runner: the page pauses when it loses focus, and the tick clock stops', async ({ page }) => {
  await open(page);
  await control(page, 'play').click();
  await page.clock.runFor(30 * FRAME_MS);
  const before = Number(await screen(page, 'play').getAttribute('data-tick'));
  expect(before).toBeGreaterThan(0);

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(screen(page, 'pause')).toBeVisible();
  // Time goes on, and the game does not.
  await page.clock.runFor(2000);
  await control(page, 'resume').click();
  await page.clock.runFor(2 * FRAME_MS);
  const after = Number(await screen(page, 'play').getAttribute('data-tick'));
  expect(after).toBeGreaterThanOrEqual(before);
  expect(after - before, 'ticks that ran while paused').toBeLessThanOrEqual(3);
});

test('runner: reset progress asks first, keeps it on cancel and deletes it on confirm', async ({ page }) => {
  await open(page, true);
  await control(page, 'levels').click();
  await expect(control(page, 'level-r03')).toHaveAttribute('data-locked', 'false');
  await control(page, 'back').click();

  await control(page, 'settings').click();
  await control(page, 'reset').click();
  await expect(page.locator('[data-dialog="confirm"]')).toBeVisible();
  expect(await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? '{}').levels.r02?.stars, KEY)).toBe(2);

  await control(page, 'cancel').click();
  await expect(page.locator('[data-dialog="confirm"]')).toHaveCount(0);
  expect(await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? '{}').levels.r02?.stars, KEY)).toBe(2);

  await control(page, 'reset').click();
  await control(page, 'confirm').click();
  await expect(page.locator('[data-dialog="confirm"]')).toHaveCount(0);
  expect(await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? '{"levels":{}}').levels.r02 ?? null, KEY)).toBeNull();
  await control(page, 'back').click();
  await control(page, 'levels').click();
  await expect(control(page, 'level-r02')).toHaveAttribute('data-locked', 'true');
});

test('runner: play works with storage blocked, and the title says so once', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  await open(page);
  await expect(page.locator('[data-notice="storage"]')).toHaveText('Progress will not be saved.');
  await control(page, 'play').click();
  await runUntilResults(page);
  await expect(screen(page, 'results')).toHaveAttribute('data-phase', 'lost');
  await control(page, 'levels').click();
  await control(page, 'back').click();
  await expect(screen(page, 'title')).toBeVisible();
  await expect(page.locator('[data-notice="storage"]')).toHaveCount(0);
});
