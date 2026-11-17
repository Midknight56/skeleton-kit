import { expect, readProof, test } from './fixtures';

const SIZES = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '360x640', width: 360, height: 640 },
];

for (const size of SIZES) {
  test(`landing page at ${size.name}: the frame is in the first screen and the watch run starts with no tap`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/');
    const frame = page.locator('iframe[data-frame="watch"]');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('src', './garden/?watch=g03');
    const box = await frame.boundingBox();
    expect(box, 'the frame has a box').not.toBeNull();
    // Inside the first screen: nothing of the frame is below the fold or outside the sides.
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    expect(box!.width, 'the frame is big enough to play in').toBeGreaterThanOrEqual(280);
    expect(box!.height).toBeGreaterThanOrEqual(240);

    // No tap, no click: the watch screen opens in the frame and its tick moves on.
    const inner = page.frameLocator('iframe[data-frame="watch"]');
    const watch = inner.locator('[data-screen="watch"]');
    await expect(watch).toBeVisible();
    await expect(inner.locator('[data-proof="line"]')).toHaveText('Proved in 4 actions');
    await expect.poll(async () => Number(await watch.getAttribute('data-tick')), { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    await expect(watch).toHaveAttribute('data-phase', /^(playing|won)$/);

    // The sentence for who the kit is for, and no scrolling needed to see the frame.
    await expect(page.locator('[data-landing="who"]')).toBeVisible();
    await expect(page.locator('[data-landing="who"]')).toContainText('nobody to test a build');
  });
}

test('landing page at 1920x1080: the frame is half the column, with the tool calls beside it', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const frame = await page.locator('iframe[data-frame="watch"]').boundingBox();
  const calls = await page.locator('[data-calls]').boundingBox();
  expect(frame, 'the frame has a box').not.toBeNull();
  expect(calls, 'the calls have a box').not.toBeNull();
  expect(frame!.width).toBeGreaterThanOrEqual(520);
  expect(calls!.x, 'the calls are right of the frame').toBeGreaterThanOrEqual(frame!.x + frame!.width);
  expect(frame!.y + frame!.height).toBeLessThanOrEqual(1080);
});

test('landing page at 360x640: the calls stay under the frame', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  const frame = await page.locator('iframe[data-frame="watch"]').boundingBox();
  const calls = await page.locator('[data-calls]').boundingBox();
  expect(calls!.y).toBeGreaterThanOrEqual(frame!.y + frame!.height);
});

test('landing page: the tool calls come from the proof of g03', async ({ page }) => {
  await page.goto('/');
  const calls = page.locator('[data-calls] li');
  await expect(calls).toHaveCount(3);
  const proof = readProof('garden', 'g03');
  await expect(calls.nth(0)).toContainText('new_game');
  await expect(calls.nth(0)).toContainText('"level":"g03"');
  await expect(calls.nth(0)).toContainText('"seed":1');
  await expect(calls.nth(1)).toContainText('act');
  await expect(calls.nth(1)).toContainText(JSON.stringify(proof.actions));
  await expect(calls.nth(2)).toContainText('replay');
});

test('landing page: two cards open the two games, and a link names the repository', async ({ page }) => {
  await page.goto('/');
  const garden = page.locator('a[data-card="garden"]');
  const runner = page.locator('a[data-card="runner"]');
  await expect(garden).toHaveAttribute('href', './garden/');
  await expect(runner).toHaveAttribute('href', './runner/');
  await expect(page.locator('a[data-link="repository"]')).toBeVisible();
  await expect(page.locator('a[data-link="privacy"]')).toHaveAttribute('href', './privacy/');
  await garden.click();
  await expect(page).toHaveURL(/\/garden\/$/);
  await expect(page.locator('[data-screen="title"]')).toBeVisible();
});

test('the other three pages answer', async ({ page, request }) => {
  for (const path of ['/garden/', '/runner/', '/privacy/', '/']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }
  await page.goto('/privacy/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('tr[data-event]')).toHaveCount(5);
  await expect(page.locator('tr[data-event="watch_end"]')).toBeVisible();
  await expect(page.locator('tr[data-event="level_end"]')).toContainText('won, lost or left');
  await expect(page.locator('main')).toContainText('sees the address of the request');
  await page.goto('/runner/');
  await expect(page.locator('[data-screen="title"]')).toBeVisible();
});
