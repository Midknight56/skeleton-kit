import { control, expect, screen, test } from './fixtures';
import type { Page } from '@playwright/test';

// Presses Tab until every control of the open screen has had focus. Each focused control must
// show a focus mark: an outline of 2 px or more that is not none.
async function tabThrough(page: Page, name: string): Promise<string[]> {
  const expected = await page.locator(`[data-screen="${name}"] [data-control]`).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.control as string));
  expect(expected.length, `${name} has controls`).toBeGreaterThan(0);
  const seen: string[] = [];
  // Focus starts on the first control, which the shell sets itself, or on the page. Start from the page.
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
  return seen;
}

test('garden: Tab alone reaches every control of the screens and each shows a focus mark', async ({ page }) => {
  await page.goto('/garden/');
  await expect(screen(page, 'title')).toBeVisible();
  await tabThrough(page, 'title');

  // Level select, opened with the keyboard.
  await control(page, 'levels').focus();
  await page.keyboard.press('Enter');
  await expect(screen(page, 'levels')).toBeVisible();
  await tabThrough(page, 'levels');
  await control(page, 'back').focus();
  await page.keyboard.press('Enter');

  // Settings, with the confirm box.
  await control(page, 'settings').focus();
  await page.keyboard.press('Enter');
  await expect(screen(page, 'settings')).toBeVisible();
  await tabThrough(page, 'settings');
  await control(page, 'reset').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-dialog="confirm"]')).toBeVisible();
  await tabThrough(page, 'settings');
  await control(page, 'cancel').focus();
  await page.keyboard.press('Enter');
  await control(page, 'back').focus();
  await page.keyboard.press('Enter');

  // Play with keys only: key 1 lights the lantern, space waits. This also wins g01.
  await control(page, 'play').focus();
  await page.keyboard.press('Enter');
  await expect(screen(page, 'play')).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('1');
  await page.keyboard.press(' ');
  await expect(screen(page, 'results')).toBeVisible();
  await tabThrough(page, 'results');

  // Pause, reached with the Escape key.
  await control(page, 'retry').focus();
  await page.keyboard.press('Enter');
  await expect(screen(page, 'play')).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Escape');
  await expect(screen(page, 'pause')).toBeVisible();
  await tabThrough(page, 'pause');
});
