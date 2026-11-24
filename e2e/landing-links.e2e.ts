import { expect, test } from './fixtures';

// Task 2 of .kiro/specs/landing-try-a-rule. Both games have a named play link in the first screen.

const GAMES = [
  { id: 'garden', name: 'Moth Garden', kind: /turn puzzle/i, path: /\/garden\/$/ },
  { id: 'runner', name: 'Broom Runner', kind: /timed runner/i, path: /\/runner\/$/ },
] as const;

for (const size of [{ width: 360, height: 640 }, { width: 1280, height: 800 }]) {
  const name = `${size.width}x${size.height}`;

  test(`landing at ${name}: both named play links and the demo are inside the first screen`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const boxes = [];
    for (const game of GAMES) {
      const link = page.locator(`a[data-card="${game.id}"]`);
      await expect(link).toBeVisible();
      const text = (await link.innerText()).replace(/\s+/g, ' ');
      expect(text, game.id).toBe(`Play ${game.name}`);
      // The kind of game is in the accessible name, so the label stays on one line.
      expect(await link.getAttribute('aria-label'), game.id).toMatch(game.kind);
      const box = (await link.boundingBox())!;
      expect(box.x, `${game.id} left`).toBeGreaterThanOrEqual(16);
      expect(box.x + box.width, `${game.id} right`).toBeLessThanOrEqual(size.width - 16);
      expect(box.y, `${game.id} top`).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, `${game.id} bottom, no scrolling`).toBeLessThanOrEqual(size.height);
      expect(box.height, `${game.id} height`).toBeGreaterThanOrEqual(44);
      boxes.push(box);
    }
    const [a, b] = boxes as [NonNullable<(typeof boxes)[number]>, NonNullable<(typeof boxes)[number]>];
    const gapX = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
    const gapY = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
    expect(Math.max(gapX, gapY), 'the two links are 12 px apart').toBeGreaterThanOrEqual(12);
    const frame = (await page.locator('iframe[data-frame="watch"]').boundingBox())!;
    expect(frame.y + frame.height, 'the demo stays in the first screen').toBeLessThanOrEqual(size.height);
    for (const game of boxes) {
      const overlap = game.x < frame.x + frame.width && frame.x < game.x + game.width && game.y < frame.y + frame.height && frame.y < game.y + game.height;
      expect(overlap, 'a link does not cover the demo').toBe(false);
    }
  });

  for (const game of GAMES) {
    test(`landing at ${name}: one press on the ${game.name} link opens ${game.name}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/');
      await page.locator(`a[data-card="${game.id}"]`).click();
      await expect(page).toHaveURL(game.path);
      await expect(page.locator('[data-screen="title"]')).toBeVisible();
    });
  }
}
