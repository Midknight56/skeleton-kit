import { FRAME_MS, control, expect, freezeClock, installClock, lastPlay, levelIds, playRunnerReplay, readProof, recordPlay, screen, test } from './fixtures';

const KEY = 'kit.runner.v1';

// The assumption of this test: the fake clock calls the frame callback every 16 ms.
test('runner: the fake clock calls requestAnimationFrame every 16 ms', async ({ page }) => {
  await installClock(page);
  await page.goto('/runner/');
  await freezeClock(page);
  const times = await (async () => {
    await page.evaluate(() => {
      const seen: number[] = [];
      (window as unknown as { __frames: number[] }).__frames = seen;
      const loop = (ts: number) => {
        seen.push(ts);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    await page.clock.runFor(160);
    return page.evaluate(() => (window as unknown as { __frames: number[] }).__frames);
  })();
  expect(times.length).toBe(10);
  for (let i = 1; i < times.length; i++) expect((times[i] as number) - (times[i - 1] as number), `gap ${i}`).toBe(16);
});

test('runner: title, how to play, r01 won by its proof replay, results, settings kept after reload', async ({ page }) => {
  test.setTimeout(120_000);
  await recordPlay(page);
  await installClock(page);
  await page.goto('/runner/');
  await expect(screen(page, 'title')).toBeVisible();
  await freezeClock(page);

  await control(page, 'how').click();
  await expect(page.locator('[data-screen="how"] li')).toContainText(['Tap: jump', 'Take candles', 'Space: jump']);
  await control(page, 'back').click();

  await control(page, 'play').click();
  // The play root shows its tick after the first frame.
  await page.clock.runFor(2 * FRAME_MS);
  await expect(screen(page, 'play')).toHaveAttribute('data-tick', '0');
  const replay = readProof('runner', 'r01');
  await playRunnerReplay(page, replay);
  await expect(screen(page, 'results')).toBeVisible();
  await expect(screen(page, 'results')).toHaveAttribute('data-phase', 'won');
  const seen = await lastPlay(page);
  expect(seen?.phase).toBe('won');
  expect(seen?.tick).toBe(String(replay.actions.length));
  expect(seen?.hash).toBe(replay.finalHash);
  await expect(page.locator('[data-screen="results"] [data-stars]')).toHaveAttribute('data-stars', /^[123]$/);
  await expect(control(page, 'next')).toBeVisible();

  // Settings changed and kept after reload, and the progress too.
  await control(page, 'levels').click();
  await control(page, 'back').click();
  await control(page, 'settings').click();
  await control(page, 'sound').click();
  await expect(control(page, 'sound')).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await freezeClock(page);
  await control(page, 'settings').click();
  await expect(control(page, 'sound')).toHaveAttribute('aria-pressed', 'false');
  await expect(control(page, 'music')).toHaveAttribute('aria-pressed', 'true');
  await control(page, 'back').click();
  await control(page, 'levels').click();
  await expect(control(page, 'level-r01')).toHaveAttribute('data-stars', /^[123]$/);
  await expect(control(page, 'level-r02')).toHaveAttribute('data-locked', 'false');
  await control(page, 'back').click();
  await control(page, 'credits').click();
  await expect(screen(page, 'credits')).toBeVisible();
});

// Each course, won by its proof replay. A course after r01 is open when the course before it has stars,
// so the test writes that progress first, in the format of the shell.
const ids = levelIds('runner');
for (const [index, id] of ids.entries()) {
  test(`runner: ${id} won by its proof replay, and the final hash matches`, async ({ page }) => {
    test.setTimeout(120_000);
    const done = Object.fromEntries(ids.slice(0, index).map((earlier) => [earlier, { stars: 3, best: 1 }]));
    await page.addInitScript(
      ([key, value]) => {
        if (!window.localStorage.getItem(key as string)) window.localStorage.setItem(key as string, value as string);
      },
      [KEY, JSON.stringify({ version: 1, levels: done, settings: { sound: true, music: true }, lessons: {} })],
    );
    await recordPlay(page);
    await installClock(page);
    await page.goto('/runner/');
    await freezeClock(page);
    await control(page, 'levels').click();
    await control(page, `level-${id}`).click();
    await page.clock.runFor(2 * FRAME_MS);
    await expect(screen(page, 'play')).toHaveAttribute('data-tick', '0');
    const replay = readProof('runner', id);
    await playRunnerReplay(page, replay);
    await expect(screen(page, 'results')).toHaveAttribute('data-phase', 'won');
    const seen = await lastPlay(page);
    expect(seen?.phase).toBe('won');
    expect(seen?.tick).toBe(String(replay.actions.length));
    expect(seen?.hash).toBe(replay.finalHash);
    // After the last course there is no next button.
    if (index === ids.length - 1) await expect(control(page, 'next')).toHaveCount(0);
    else await expect(control(page, 'next')).toBeVisible();
  });
}
