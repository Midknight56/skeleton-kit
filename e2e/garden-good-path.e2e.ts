import { control, expect, lastPlay, levelIds, playGardenReplay, readProof, recordPlay, screen, test } from './fixtures';

test('garden: title, how to play, every level won by its proof replay, settings kept after reload', async ({ page }) => {
  test.setTimeout(120_000);
  await recordPlay(page);
  await page.goto('/garden/');

  // Title and how to play.
  await expect(screen(page, 'title')).toBeVisible();
  await control(page, 'how').click();
  await expect(screen(page, 'how')).toBeVisible();
  await expect(page.locator('[data-screen="how"] li')).toContainText(['Tap a lantern, or press 1 to 5, to light it.', 'every moth flies one step', 'Tap Wait, or press Space', 'Tap another lantern to move the light.', 'A moth rests on a free flower.']);
  await control(page, 'back').click();
  await expect(screen(page, 'title')).toBeVisible();

  // Every level, one after the other, from the Play button.
  const ids = levelIds('garden');
  await control(page, 'play').click();
  for (const [index, id] of ids.entries()) {
    const replay = readProof('garden', id);
    await expect(screen(page, 'play')).toBeVisible();
    await expect(screen(page, 'play')).toHaveAttribute('data-tick', '0');
    await playGardenReplay(page, replay);
    await expect(screen(page, 'results')).toBeVisible();
    await expect(screen(page, 'results')).toHaveAttribute('data-phase', 'won');
    const seen = await lastPlay(page);
    expect(seen?.phase, `${id} phase`).toBe('won');
    expect(seen?.hash, `${id} final hash`).toBe(replay.finalHash);
    expect(seen?.tick, `${id} tick`).toBe(String(replay.actions.length));
    // The proof replay is the par, so it earns 3 stars.
    await expect(page.locator('[data-screen="results"] [data-stars]')).toHaveAttribute('data-stars', '3');
    if (index < ids.length - 1) await control(page, 'next').click();
  }
  // No next button after the last level.
  await expect(control(page, 'next')).toHaveCount(0);

  // The level select shows the stars of every level.
  await control(page, 'levels').click();
  await expect(screen(page, 'levels')).toBeVisible();
  for (const id of ids) await expect(control(page, `level-${id}`)).toHaveAttribute('data-stars', '3');
  await control(page, 'back').click();

  // Settings changed and kept after a reload.
  await control(page, 'settings').click();
  await expect(control(page, 'sound')).toHaveAttribute('aria-pressed', 'true');
  await control(page, 'sound').click();
  await control(page, 'music').click();
  await control(page, 'usage').click();
  await expect(control(page, 'sound')).toHaveAttribute('aria-pressed', 'false');
  await expect(control(page, 'music')).toHaveAttribute('aria-pressed', 'false');
  await expect(control(page, 'usage')).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await control(page, 'settings').click();
  await expect(control(page, 'sound')).toHaveAttribute('aria-pressed', 'false');
  await expect(control(page, 'music')).toHaveAttribute('aria-pressed', 'false');
  await expect(control(page, 'usage')).toHaveAttribute('aria-pressed', 'false');
  // Progress is kept too.
  await control(page, 'back').click();
  await control(page, 'levels').click();
  await expect(control(page, 'level-g12')).toHaveAttribute('data-stars', '3');

  // Credits.
  await control(page, 'back').click();
  await control(page, 'credits').click();
  await expect(screen(page, 'credits')).toBeVisible();
  await expect(screen(page, 'credits')).toContainText('Made by Adrian Ferguson');
  await expect(screen(page, 'credits')).toContainText('Every sound is made in code.');
});
