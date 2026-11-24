import { control, expect, screen, test } from './fixtures';

// The faults a tester found on 2026-11-24. Each test names the task of .kiro/specs/tester-fixes it checks.

test('task 1: the accessibility tree of the garden play screen holds the state in words after a move', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'play').click();
  const play = screen(page, 'play');
  await expect(play).toHaveAttribute('data-hash', /^[0-9a-f]{16}$/);
  await expect(play.getByRole('status')).toContainText('No lantern is lit.');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('1');
  await expect(play).toHaveAttribute('data-tick', '1');
  const tree = await play.ariaSnapshot();
  expect(tree).toContain('Turn 1 of');
  expect(tree).toContain('Lantern 1 is lit.');
  expect(tree).toContain('Lantern 2 is not lit.');
  expect(tree).toMatch(/Moth 1 is (at|home)/);
  const region = play.getByRole('status');
  const box = (await region.boundingBox())!;
  expect(box.width, 'the text version is hidden from the eye').toBeLessThanOrEqual(2);
  await control(page, 'undo').click();
  await expect(region).toContainText('Turn 0 of');
  await expect(region).toContainText('No lantern is lit.');
});

test('task 2: Undo does nothing once the level is won, and the result screen shows', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'play').click();
  const play = screen(page, 'play');
  await expect(play).toHaveAttribute('data-hash', /^[0-9a-f]{16}$/);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('1');
  await expect(play).toHaveAttribute('data-tick', '1');
  await page.keyboard.press(' ');
  await expect(play).toHaveAttribute('data-phase', 'won');
  const undo = control(page, 'undo');
  await expect(undo).toBeDisabled();
  await undo.click({ force: true, timeout: 2000 }).catch(() => undefined);
  await expect(screen(page, 'results')).toBeVisible();
  expect(await page.locator('[data-screen="results"]').textContent()).toBeTruthy();
  // The win still counts, and the board did not go back to turn 1.
  await expect(play).toHaveCount(0);
});
test('task 3: Back from Pause returns to the paused board at the same turn', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'levels').click();
  await control(page, 'level-g01').click();
  const play = screen(page, 'play');
  await expect(play).toHaveAttribute('data-hash', /^[0-9a-f]{16}$/);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('1');
  await expect(play).toHaveAttribute('data-tick', '1');
  const hash = await play.getAttribute('data-hash');
  await control(page, 'pause').click();
  await expect(screen(page, 'pause')).toBeVisible();
  await page.goBack();
  await expect(screen(page, 'play')).toBeVisible();
  await expect(screen(page, 'play')).toHaveAttribute('data-tick', '1');
  await expect(screen(page, 'play')).toHaveAttribute('data-hash', hash!);
});
test('task 4: a number key reaches the garden after a mouse click on Undo', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'play').click();
  const play = screen(page, 'play');
  await expect(play).toHaveAttribute('data-hash', /^[0-9a-f]{16}$/);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('1');
  await expect(play).toHaveAttribute('data-tick', '1');
  await control(page, 'undo').click();
  await expect(play).toHaveAttribute('data-tick', '0');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-control'))).toBe('undo');
  await page.keyboard.press('1');
  await expect(play).toHaveAttribute('data-tick', '1');
  // Space on a focused button keeps its button meaning: Undo again.
  await control(page, 'undo').focus();
  await page.keyboard.press(' ');
  await expect(play).toHaveAttribute('data-tick', '0');
});
async function controlBoxes(page: import('@playwright/test').Page, root: string): Promise<{ id: string; x: number; y: number; w: number; h: number }[]> {
  return page.evaluate((selector) => {
    return Array.from(document.querySelectorAll<HTMLElement>(`${selector} [data-control]`)).map((el) => {
      const b = el.getBoundingClientRect();
      return { id: el.dataset.control ?? '', x: b.x, y: b.y, w: b.width, h: b.height };
    });
  }, root);
}

function expectLaidOut(boxes: { id: string; x: number; y: number; w: number; h: number }[], width: number, height: number): void {
  expect(boxes.length).toBeGreaterThan(0);
  for (const b of boxes) {
    expect(b.x, `${b.id} left edge`).toBeGreaterThanOrEqual(16);
    expect(b.y, `${b.id} top edge`).toBeGreaterThanOrEqual(16);
    expect(b.x + b.w, `${b.id} right edge`).toBeLessThanOrEqual(width - 16);
    expect(b.y + b.h, `${b.id} bottom edge`).toBeLessThanOrEqual(height - 16);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const c = boxes[j]!;
      const dx = Math.max(a.x - (c.x + c.w), c.x - (a.x + a.w), 0);
      const dy = Math.max(a.y - (c.y + c.h), c.y - (a.y + a.h), 0);
      expect(Math.hypot(dx, dy), `${a.id} and ${c.id} are 12 px apart`).toBeGreaterThanOrEqual(12);
    }
  }
}

test('task 5: a resize during Play lays the controls out again and keeps the game', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/garden/');
  await control(page, 'play').click();
  const play = screen(page, 'play');
  await expect(play).toHaveAttribute('data-hash', /^[0-9a-f]{16}$/);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('1');
  await expect(play).toHaveAttribute('data-tick', '1');
  const hash = await play.getAttribute('data-hash');
  await page.setViewportSize({ width: 640, height: 360 });
  await expect.poll(async () => (await controlBoxes(page, '[data-screen="play"]')).every((b) => b.y + b.h <= 360 - 16)).toBe(true);
  expectLaidOut(await controlBoxes(page, '[data-screen="play"]'), 640, 360);
  await expect(play).toHaveAttribute('data-tick', '1');
  await expect(play).toHaveAttribute('data-hash', hash!);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(360);
  const canvas = (await page.locator('[data-screen="play"] canvas').boundingBox())!;
  expect(canvas.width).toBeGreaterThanOrEqual(600);
  // The game goes on after the resize.
  await page.keyboard.press(' ');
  await expect(play).toHaveAttribute('data-tick', '2');
});

test('task 5: a resize during Watch lays the controls out again and does not restart the run', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/garden/?watch=g03');
  const watch = screen(page, 'watch');
  await expect(watch).toHaveAttribute('data-tick', '1', { timeout: 10_000 });
  const before = Number(await watch.getAttribute('data-tick'));
  await page.setViewportSize({ width: 640, height: 360 });
  await expect.poll(async () => (await controlBoxes(page, '[data-screen="watch"]')).every((b) => b.y + b.h <= 360 - 16)).toBe(true);
  expectLaidOut(await controlBoxes(page, '[data-screen="watch"]'), 640, 360);
  expect(Number(await watch.getAttribute('data-tick'))).toBeGreaterThanOrEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(360);
});
test('task 6: the reset confirm box traps focus, and Escape and Keep return focus to Reset progress', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'settings').click();
  await control(page, 'reset').click();
  const box = page.locator('[data-dialog="confirm"]');
  await expect(box).toBeVisible();
  await expect(control(page, 'cancel')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(control(page, 'confirm')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(control(page, 'cancel')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(control(page, 'confirm')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(control(page, 'cancel')).toBeFocused();
  // Enter on Keep closes the box and does not press Back behind it.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(box).toHaveCount(0);
  await expect(screen(page, 'settings')).toBeVisible();
  await expect(control(page, 'reset')).toBeFocused();
  await control(page, 'reset').click();
  await page.keyboard.press('Escape');
  await expect(box).toHaveCount(0);
  await expect(control(page, 'reset')).toBeFocused();
});
for (const game of ['garden', 'runner']) {
  for (const size of [{ width: 360, height: 640 }, { width: 768, height: 1024 }, { width: 1920, height: 1080 }]) {
    test(`task 7: ${game} watch at ${size.width}x${size.height} has previous and next level controls that follow the layout rules`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`/${game}/?watch=${game === 'garden' ? 'g02' : 'r02'}`);
      const watch = screen(page, 'watch');
      await expect(watch).toBeVisible();
      const label = watch.locator('[data-watch-level]');
      await expect(label).toHaveText('Level 2');
      const boxes = await controlBoxes(page, '[data-screen="watch"]');
      expectLaidOut(boxes, size.width, size.height);
      for (const b of boxes) {
        expect(b.h, `${b.id} touch height`).toBeGreaterThanOrEqual(44);
        expect(b.w, `${b.id} touch width`).toBeGreaterThanOrEqual(44);
      }
      // The level number keeps 12 px from both controls, and nothing sits over the play area.
      const text = (await label.boundingBox())!;
      for (const id of ['level-prev', 'level-next']) {
        const b = boxes.find((c) => c.id === id)!;
        const dx = Math.max(text.x - (b.x + b.w), b.x - (text.x + text.width), 0);
        expect(dx, `${id} and the level number`).toBeGreaterThanOrEqual(12);
      }
      const canvas = (await watch.locator('canvas').boundingBox())!;
      for (const id of ['level-prev', 'level-next']) {
        const b = boxes.find((c) => c.id === id)!;
        expect(b.y + b.h, `${id} is above the play area picture`).toBeLessThanOrEqual(canvas.y + canvas.height);
      }
    });
  }

  test(`task 7: ${game} watch moves to the neighbour level, disabled at the ends, and keeps ?watch= working`, async ({ page }) => {
    const first = game === 'garden' ? 'g01' : 'r01';
    const second = game === 'garden' ? 'g02' : 'r02';
    await page.goto(`/${game}/?watch=${first}`);
    const watch = screen(page, 'watch');
    const label = watch.locator('[data-watch-level]');
    await expect(label).toHaveText('Level 1');
    await expect(control(page, 'level-prev')).toBeDisabled();
    await expect(control(page, 'level-next')).toBeEnabled();
    await control(page, 'level-next').click();
    await expect(label).toHaveText('Level 2');
    await expect(control(page, 'level-prev')).toBeEnabled();
    await expect(watch.locator('[data-proof="line"]')).toBeVisible();
    await control(page, 'level-prev').click();
    await expect(label).toHaveText('Level 1');
    await page.goto(`/${game}/?watch=${second}`);
    await expect(screen(page, 'watch').locator('[data-watch-level]')).toHaveText('Level 2');
    // The last level has no next level.
    const last = game === 'garden' ? 'g12' : 'r06';
    await page.goto(`/${game}/?watch=${last}`);
    await expect(control(page, 'level-next')).toBeDisabled();
    await expect(control(page, 'level-prev')).toBeEnabled();
  });
}
test('task 7: the proof line sits under the level row and does not overlap it', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/garden/?watch=g03');
  const line = (await screen(page, 'watch').locator('[data-proof="line"]').boundingBox())!;
  const prev = (await control(page, 'level-prev').boundingBox())!;
  expect(line.y).toBeGreaterThanOrEqual(prev.y + prev.height);
});
test('task 8: the garden level 1 hint asks for a lantern again after Undo', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'play').click();
  const play = screen(page, 'play');
  const hint = play.locator('[data-hint]');
  await expect(hint).toHaveText('Tap lantern');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('1');
  await expect(hint).toHaveText('Then wait');
  await control(page, 'undo').click();
  await expect(play).toHaveAttribute('data-tick', '0');
  await expect(hint).toHaveText('Tap lantern');
});
for (const size of [{ width: 360, height: 640 }, { width: 768, height: 1024 }, { width: 1920, height: 1080 }]) {
  test(`task 9: the garden level cards show the fewest moves at ${size.width}x${size.height}, and the runner cards do not`, async ({ page }) => {
    // No hover swing: a turning button would move its box.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(size);
    await page.goto('/garden/');
    await control(page, 'levels').click();
    const tile = control(page, 'level-g01');
    const label = tile.locator('[data-moves]');
    await expect(label).toHaveText('2 moves');
    expect(Number.parseFloat(await label.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
    const t = (await tile.boundingBox())!;
    const l = (await label.boundingBox())!;
    expect(l.x - t.x, 'left padding').toBeGreaterThanOrEqual(8);
    expect(t.x + t.width - (l.x + l.width), 'right padding').toBeGreaterThanOrEqual(8);
    expect(l.y - t.y, 'top padding').toBeGreaterThanOrEqual(8);
    expect(t.y + t.height - (l.y + l.height), 'bottom padding').toBeGreaterThanOrEqual(8);
    // A locked card has no label.
    await expect(control(page, 'level-g02').locator('[data-moves]')).toHaveCount(0);
    await page.goto('/runner/');
    await control(page, 'levels').click();
    await expect(page.locator('[data-moves]')).toHaveCount(0);
  });
}
test('task 10: the landing caption and counter hide when the frame leaves Watch, and return when a demo plays again', async ({ page }) => {
  await page.goto('/');
  const inner = page.frameLocator('iframe[data-frame="watch"]');
  const caption = page.locator('.caption');
  const counter = page.locator('[data-count]');
  await expect(inner.locator('[data-screen="watch"]')).toBeVisible();
  await expect(caption).toBeVisible();
  await expect(caption).toContainText('level 3');
  await expect(counter).toContainText(/action \d+ of \d+/);
  await inner.locator('[data-control="back"]').click();
  await expect(inner.locator('[data-screen="title"]')).toBeVisible();
  await expect(caption).toBeHidden();
  await expect(counter).toBeHidden();
  // Watch again from the title screen of the frame: another level plays, and the caption names it.
  await inner.locator('[data-control="watch"]').click();
  await expect(inner.locator('[data-screen="watch"]')).toBeVisible();
  await expect(caption).toBeVisible();
  await expect(caption).toContainText('level 1');
  await expect(counter).toBeVisible();
  await expect(counter).toContainText(/action \d+ of \d+/);
});
for (const game of ['garden', 'runner']) {
  test(`task 11: Back on the privacy page opened from ${game} returns to its Settings screen`, async ({ page }) => {
    await page.goto(`/${game}/`);
    await control(page, 'settings').click();
    await control(page, 'privacy').click();
    await expect(page).toHaveURL(new RegExp(`/privacy/\\?from=${game}$`));
    await expect(page.locator('h1')).toHaveText('Privacy');
    await page.locator('a.back').click();
    await expect(page).toHaveURL(new RegExp(`/${game}/`));
    await expect(screen(page, 'settings')).toBeVisible();
    // Back of Settings goes to the title screen as before.
    await control(page, 'back').click();
    await expect(screen(page, 'title')).toBeVisible();
  });
}

test('task 11: Back on the privacy page opened from the landing page returns to the landing page', async ({ page }) => {
  await page.goto('/');
  await page.locator('a[data-link="privacy"]').click();
  await expect(page).toHaveURL(/\/privacy\/$/);
  await page.locator('a.back').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('main h1')).toContainText('A kit for game developers');
});

test('task 11: a from value that is not a game name does not leave the site', async ({ page }) => {
  await page.goto('/privacy/?from=//example.test');
  await expect(page.locator('a.back')).toHaveAttribute('href', '../');
  await page.goto('/privacy/?from=garden');
  await expect(page.locator('a.back')).toHaveAttribute('href', '../garden/?open=settings');
});
test('task 13: with reduced motion a new menu screen has no animation at all, not even a fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/garden/');
  await expect(screen(page, 'title')).toBeVisible();
  for (const id of ['levels', 'settings', 'how', 'credits']) {
    await page.goto('/garden/');
    await control(page, id).click();
    const card = screen(page, id);
    await expect(card).toBeVisible();
    // Read at once, with no waiting for a fade to end.
    const state = await card.evaluate((el) => ({ name: getComputedStyle(el).animationName, running: document.getAnimations().length, opacity: getComputedStyle(el).opacity }));
    expect(state, id).toEqual({ name: 'none', running: 0, opacity: '1' });
  }
});