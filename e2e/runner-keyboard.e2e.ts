import type { Page } from '@playwright/test';
import { FRAME_MS, control, expect, freezeClock, installClock, runUntilResults, screen, test } from './fixtures';

// Presses Tab until every control of the open screen has had focus. Each focused control must
// show a focus mark: an outline of 2 px or more that is not none.
async function tabThrough(page: Page, name: string): Promise<void> {
  const expected = await page.locator(`[data-screen="${name}"] [data-control]`).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.control as string));
  expect(expected.length, `${name} has controls`).toBeGreaterThan(0);
  const seen: string[] = [];
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < expected.length + 2 && seen.length < expected.length; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || !el.dataset.control) return null;
      const style = getComputedStyle(el);
      return { id: el.dataset.control, outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) };
    });
    if (!info) continue;
    expect(info.outlineStyle, `${name}: ${info.id} focus mark`).not.toBe('none');
    expect(info.outlineWidth, `${name}: ${info.id} focus mark width`).toBeGreaterThanOrEqual(2);
    if (!seen.includes(info.id)) seen.push(info.id);
  }
  expect(seen.sort(), `${name}: controls reached by Tab`).toEqual([...new Set(expected)].sort());
}

async function enter(page: Page, id: string): Promise<void> {
  await control(page, id).focus();
  await page.keyboard.press('Enter');
}

test('runner: Tab alone reaches every control of the screens and each shows a focus mark', async ({ page }) => {
  await installClock(page);
  await page.goto('/runner/');
  await freezeClock(page);
  await expect(screen(page, 'title')).toBeVisible();
  await tabThrough(page, 'title');

  await enter(page, 'levels');
  await expect(screen(page, 'levels')).toBeVisible();
  await tabThrough(page, 'levels');
  await enter(page, 'back');

  await enter(page, 'settings');
  await expect(screen(page, 'settings')).toBeVisible();
  await tabThrough(page, 'settings');
  await enter(page, 'reset');
  await expect(page.locator('[data-dialog="confirm"]')).toBeVisible();
  await tabThrough(page, 'settings');
  await enter(page, 'cancel');
  await enter(page, 'back');

  // Pause, reached with the Escape key during play.
  await enter(page, 'play');
  await page.clock.runFor(4 * FRAME_MS);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Escape');
  await expect(screen(page, 'pause')).toBeVisible();
  await tabThrough(page, 'pause');

  // Results, after a lost course.
  await enter(page, 'resume');
  await runUntilResults(page);
  await tabThrough(page, 'results');
});
