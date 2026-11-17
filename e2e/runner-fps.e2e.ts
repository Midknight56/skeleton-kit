import { expect, screen, test } from './fixtures';

// The runner must keep 60 frames a second with its effects on. Course r01 is played for more than 5
// seconds in headless Chromium at 1920 by 1080, and the frames are counted with requestAnimationFrame.
// The course is played by the watch screen, which replays the proof of r01 in real time through the
// same canvas painter and the same effects as a person's play. Real time is needed, so no fake clock.
// The numbers go to the report of the run, and the test fails when the median falls below 55.

test.use({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'no-preference' });

test('the runner course r01 keeps 60 frames a second at 1920 by 1080', async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.goto('/runner/?watch=r01');
  const canvas = page.locator('[data-screen="watch"] canvas');
  await expect(canvas).toHaveAttribute('data-effects', /\d+/);
  await expect(screen(page, 'watch')).toBeVisible();
  // Let the first frames settle.
  await page.waitForTimeout(500);

  const result = await page.evaluate(
    () =>
      new Promise<{ ms: number; frames: number; medianFps: number; worstMs: number; meanFps: number; maxLive: number; ticks: number }>((resolve) => {
        const stamps: number[] = [];
        let maxLive = 0;
        const root = document.querySelector<HTMLElement>('[data-screen="watch"]');
        const startTick = Number(root?.dataset.tick ?? 0);
        const loop = (t: number) => {
          stamps.push(t);
          const live = Number(document.querySelector('[data-screen="watch"] canvas')?.getAttribute('data-effects') ?? 0);
          if (live > maxLive) maxLive = live;
          if (t - (stamps[0] as number) < 5500) {
            requestAnimationFrame(loop);
            return;
          }
          const deltas = stamps.slice(1).map((s, i) => s - (stamps[i] as number));
          const sorted = [...deltas].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)] as number;
          resolve({
            ms: t - (stamps[0] as number),
            frames: deltas.length,
            medianFps: 1000 / median,
            worstMs: Math.max(...deltas),
            meanFps: (deltas.length * 1000) / (t - (stamps[0] as number)),
            maxLive,
            ticks: Number(root?.dataset.tick ?? 0) - startTick,
          });
        };
        requestAnimationFrame(loop);
      }),
  );

  const line = `runner r01 1920x1080: median ${result.medianFps.toFixed(1)} fps, mean ${result.meanFps.toFixed(1)} fps, worst frame ${result.worstMs.toFixed(1)} ms, ${result.frames} frames in ${(result.ms / 1000).toFixed(2)} s, ${result.ticks} ticks, most live particles ${result.maxLive}`;
  console.log(line);
  info.annotations.push({ type: 'frames', description: line });

  expect(result.ms).toBeGreaterThanOrEqual(5000);
  expect(result.ticks, 'the course was playing during the measure').toBeGreaterThan(100);
  expect(result.maxLive).toBeLessThanOrEqual(200);
  expect(result.medianFps).toBeGreaterThanOrEqual(55);
});
