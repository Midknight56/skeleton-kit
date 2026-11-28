import { expect, test } from './fixtures';

// Task 1 of .kiro/specs/judge-rule-replay. A check at 3 stops the winning replay and shows the failure on the
// board. A check at 4 plays the actions of the search on the board. The fixture fails on any page or console error.

const PROOF_HASH = '9a074fd5e9266b9a';

test('landing: limit 3 unloads the winning replay, limit 4 plays the real actions, Restore 8 works, offline', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-calls] li[data-call="act"]')).toHaveCount(1);
  await page.locator('[data-frame="watch"]').waitFor();
  await page.route('**/*', (route) => route.abort());

  const limit = page.locator('[data-try="limit"]');
  const run = page.locator('[data-try="run"]');
  const frame = page.locator('iframe[data-frame="watch"]');
  const fail = page.locator('[data-rule="fail"]');
  const scene = page.locator('[data-rule="scene"]');

  await limit.fill('3');
  await run.click();
  await expect(fail).toBeVisible();
  await expect(fail).toContainText(/every possible route was exhausted within 3 turns/i);
  await expect(fail).toContainText(/shortest win needs 4 turns/i);
  await expect(frame).toBeHidden();
  expect(await frame.getAttribute('src')).toBe('about:blank');
  await expect(page.locator('[data-calls] li[data-call]')).toHaveCount(0);
  await expect(page.locator('[data-calls]')).not.toContainText(/hash|applied 4/);
  await expect(page.locator('.status [data-count]')).toHaveText('no winning run');
  await expect(page.locator('[data-dots] i')).toHaveCount(0);
  await expect(limit).toBeVisible();
  await expect(run).toBeVisible();

  await limit.fill('4');
  await run.click();
  await expect(scene).toBeVisible();
  await expect(scene.locator('svg')).toHaveCount(1);
  await expect(scene).toHaveAttribute('data-applied', '4', { timeout: 10000 });
  await expect(scene).toHaveAttribute('data-phase', 'won');
  const hash4 = await page.locator('[data-try="result"]').getAttribute('data-hash');
  expect(hash4).toMatch(/^[0-9a-f]{16}$/);
  await expect(scene).toHaveAttribute('data-hash', hash4!);
  await expect(scene.locator('svg')).toContainText('Turn 4 of 4');
  await expect(page.locator('.status [data-count]')).toContainText(/action 4 of 4, won, hash/);
  await expect(page.locator('[data-dots] i[data-done="true"]')).toHaveCount(4);
  await expect(page.locator('[data-calls] li[data-call="act"]')).toHaveCount(4);
  await expect(page.locator('[data-try="result"]')).toHaveAttribute('data-count', '4');

  await limit.fill('3');
  await run.click();
  await expect(fail).toBeVisible();
  await expect(scene).toBeHidden();
  await page.waitForTimeout(1000);
  await expect(scene.locator('svg')).toHaveCount(0);

  await page.locator('[data-try="restore"]').click();
  await expect(limit).toHaveValue('8');
  await expect(scene).toHaveAttribute('data-applied', '4', { timeout: 10000 });
  await expect(scene).toHaveAttribute('data-hash', PROOF_HASH);
  await expect(scene.locator('svg')).toContainText('Turn 4 of 8');
  await expect(frame).toBeHidden();

  await limit.fill('abc');
  await run.click();
  await expect(page.locator('[data-try="result"]')).toHaveAttribute('data-won', 'error');
  await expect(scene).toHaveAttribute('data-applied', '4');
});