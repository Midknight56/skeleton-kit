import { clickItem, control, expect, screen, test } from './fixtures';

const sizes = [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 1920, height: 1080 }];

for (const size of sizes) {
  for (const game of ['garden', 'runner']) {
    for (const reducedMotion of ['reduce', 'no-preference'] as const) {
      test(`r3 ${game} title ${size.width}x${size.height} ${reducedMotion}: main art is on screen and clear of controls`, async ({ page }, info) => {
        await page.setViewportSize(size);
        await page.emulateMedia({ reducedMotion });
        await page.goto(`/${game}/`);
        await expect(control(page, 'watch')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        const name = game === 'garden' ? 'lantern' : 'witch';
        const art = page.locator(`[data-backdrop] use[href$="-${name}"]:visible`);
        await expect(art, `${name} must be drawn`).toHaveCount(1);
        const a = (await art.boundingBox())!;
        expect(a.width, 'the main art has a readable size').toBeGreaterThanOrEqual(40);
        expect(a.height).toBeGreaterThanOrEqual(60);
        expect(a.x).toBeGreaterThanOrEqual(16);
        expect(a.y).toBeGreaterThanOrEqual(16);
        expect(a.x + a.width).toBeLessThanOrEqual(size.width - 16);
        expect(a.y + a.height).toBeLessThanOrEqual(size.height - 16);
        const controls = await page.locator('[data-screen="title"] [data-control]').all();
        for (const item of controls) {
          const b = (await item.boundingBox())!;
          expect(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height, await item.textContent() ?? '').toBe(false);
        }
        if (size.width <= 480) {
          const column = (await page.locator('[data-screen="title"] [data-column]').boundingBox())!;
          expect(a.y, 'phone art is below the buttons').toBeGreaterThanOrEqual(column.y + column.height + 12);
          expect(a.y + a.height, 'phone art stays above the ground').toBeLessThanOrEqual(size.height * 0.85);
          if (game === 'garden') expect(await page.locator('[data-backdrop] use[href$="-moth"]:visible').count()).toBeGreaterThan(0);
        }
        await page.screenshot({ path: info.outputPath('title.png'), fullPage: false });
        // A new layout must also survive a turn of the phone or a desktop resize.
        await page.setViewportSize(size.width <= 480 ? sizes[2]! : sizes[1]!);
        await expect(art).toHaveCount(1);
        await page.setViewportSize(size);
        await expect(art).toHaveCount(1);
      });
    }
  }

  test(`r3 garden ${size.width}x${size.height}: Then wait points to a working button and a lit lantern also waits`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/garden/');
    await control(page, 'play').click();
    await clickItem(page, 'lantern-1');
    await expect(page.locator('[data-hint="wait-turn"]')).toHaveText('Then wait');
    const wait = control(page, 'wait');
    await wait.scrollIntoViewIfNeeded();
    await expect(wait).toBeVisible();
    expect(Number.parseFloat(await wait.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
    await wait.click();
    await expect(screen(page, 'results')).toBeVisible();
    await control(page, 'retry').click();
    await clickItem(page, 'lantern-1');
    await clickItem(page, 'lantern-1');
    await expect(screen(page, 'results')).toBeVisible();
  });
}

test('r3 garden: unused keys leave the puzzle alone and the documented keys work', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'how').click();
  await expect(screen(page, 'how')).toContainText('press 1 to 5');
  await expect(screen(page, 'how')).toContainText('press Space');
  await control(page, 'back').click();
  await control(page, 'play').click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(screen(page, 'play')).toHaveAttribute('data-hash', /^[0-9a-f]{16}$/);
  const hash = await screen(page, 'play').getAttribute('data-hash');
  for (const key of ['z', '9', 'Enter']) {
    await page.keyboard.press(key);
    await expect(screen(page, 'play')).toHaveAttribute('data-hash', hash!);
  }
  await page.keyboard.press('1');
  await page.keyboard.press(' ');
  await expect(screen(page, 'results')).toBeVisible();
});

test('r3 landing: tool calls are a display with an explanation, not an input', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-calls] li')).toHaveCount(3);
  await expect(page.locator('.panel header')).toContainText('the calls that play this level');
  await expect(page.locator('.panel footer')).toContainText('new_game starts a level');
  await expect(page.locator('.panel input, .panel textarea, .panel [contenteditable="true"]')).toHaveCount(0);
});
