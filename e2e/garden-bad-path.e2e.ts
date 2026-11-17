import { clickItem, control, expect, screen, test } from './fixtures';

const KEY = 'kit.garden.v1';

// Levels g01 to g03 finished, so that g04 is open.
const seeded = JSON.stringify({
  version: 1,
  levels: { g01: { stars: 3, best: 2 }, g02: { stars: 3, best: 3 }, g03: { stars: 3, best: 4 } },
  settings: { sound: true, music: true },
  lessons: {},
});

test('garden: a level lost for turns, retry, and a level lost in a web', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'play').click();
  // Lantern 2 does not help the moth on g01. Five waits use the 6 turns.
  await clickItem(page, 'lantern-2');
  for (let i = 0; i < 5; i++) await control(page, 'wait').click();
  await expect(screen(page, 'results')).toBeVisible();
  await expect(screen(page, 'results')).toHaveAttribute('data-phase', 'lost');
  await expect(page.locator('[data-reason]')).toHaveText('Out of turns');
  await expect(page.locator('[data-screen="results"] [data-stars]')).toHaveCount(0);
  await expect(control(page, 'next')).toHaveCount(0);

  // Retry starts the level again.
  await control(page, 'retry').click();
  await expect(screen(page, 'play')).toBeVisible();
  await expect(screen(page, 'play')).toHaveAttribute('data-tick', '0');
  await expect(screen(page, 'play')).toHaveAttribute('data-phase', 'playing');
});

test('garden: a level lost in a web shows its reason', async ({ page }) => {
  await page.addInitScript(
    ([key, value]) => {
      if (!window.localStorage.getItem(key as string)) window.localStorage.setItem(key as string, value as string);
    },
    [KEY, seeded],
  );
  await page.goto('/garden/');
  await control(page, 'levels').click();
  await control(page, 'level-g04').click();
  await clickItem(page, 'lantern-2');
  await expect(screen(page, 'results')).toBeVisible();
  await expect(page.locator('[data-reason]')).toHaveText('Caught in a web');
});

test('garden: the page pauses when it loses focus, and resume goes on', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'play').click();
  await clickItem(page, 'lantern-1');
  await expect(screen(page, 'play')).toHaveAttribute('data-tick', '1');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(screen(page, 'pause')).toBeVisible();
  await control(page, 'resume').click();
  await expect(screen(page, 'play')).toBeVisible();
  await expect(screen(page, 'play')).toHaveAttribute('data-tick', '1');

  // A hidden page pauses too.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(screen(page, 'pause')).toBeVisible();
});

test('garden: reset progress asks first, keeps it on cancel and deletes it on confirm', async ({ page }) => {
  await page.addInitScript(
    ([key, value]) => {
      if (!window.localStorage.getItem(key as string)) window.localStorage.setItem(key as string, value as string);
    },
    [KEY, seeded],
  );
  await page.goto('/garden/');
  await control(page, 'levels').click();
  await expect(control(page, 'level-g04')).toHaveAttribute('data-locked', 'false');
  await control(page, 'back').click();

  await control(page, 'settings').click();
  await control(page, 'reset').click();
  await expect(page.locator('[data-dialog="confirm"]')).toBeVisible();
  // Nothing is deleted yet.
  expect(await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? '{}').levels.g03?.stars, KEY)).toBe(3);

  await control(page, 'cancel').click();
  await expect(page.locator('[data-dialog="confirm"]')).toHaveCount(0);
  expect(await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? '{}').levels.g03?.stars, KEY)).toBe(3);

  await control(page, 'reset').click();
  await control(page, 'confirm').click();
  await expect(page.locator('[data-dialog="confirm"]')).toHaveCount(0);
  expect(await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? '{"levels":{}}').levels.g03 ?? null, KEY)).toBeNull();
  await control(page, 'back').click();
  await control(page, 'levels').click();
  await expect(control(page, 'level-g02')).toHaveAttribute('data-locked', 'true');
});

test('garden: play works with storage blocked, and the title says so once', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  await page.goto('/garden/');
  await expect(page.locator('[data-notice="storage"]')).toHaveText('Progress will not be saved.');
  await control(page, 'play').click();
  await clickItem(page, 'lantern-1');
  await control(page, 'wait').click();
  await expect(screen(page, 'results')).toHaveAttribute('data-phase', 'won');
  await control(page, 'levels').click();
  await control(page, 'back').click();
  // The notice shows once only.
  await expect(screen(page, 'title')).toBeVisible();
  await expect(page.locator('[data-notice="storage"]')).toHaveCount(0);
});
