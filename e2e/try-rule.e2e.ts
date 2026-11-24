import { expect, test } from './fixtures';

// Task 1 of .kiro/specs/landing-try-a-rule. The control changes the turn limit of garden level g03 in memory
// and runs the search of the kit in the page. After the page has loaded, every network request is refused.

const PROOF_HASH = '9a074fd5e9266b9a';
const KEY = 'kit.garden.v1';
const SAVED = JSON.stringify({ version: 1, levels: { g01: { stars: 2, best: 3 } }, settings: { sound: false, music: true, usage: true }, lessons: {} });

async function snapshot(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
}

test('landing: the turn limit control runs the search in the page with the network blocked', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(([key, value]) => localStorage.setItem(key as string, value as string), [KEY, SAVED]);
  await page.reload();
  const limit = page.locator('[data-try="limit"]');
  await expect(limit).toBeVisible();
  await expect(limit).toHaveValue('8');

  const requests: string[] = [];
  await page.route('**/*', (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
  const before = await snapshot(page);
  const run = page.locator('[data-try="run"]');
  const restore = page.locator('[data-try="restore"]');
  const result = page.locator('[data-try="result"]');

  await limit.fill('8');
  await run.click();
  await expect(result).toHaveAttribute('data-won', 'true');
  await expect(result).toHaveAttribute('data-count', '4');
  await expect(result).toContainText('4 moves');

  await limit.fill('3');
  await run.click();
  await expect(result).toHaveAttribute('data-won', 'false');
  await expect(result).toContainText(/no route wins within 3 turns/i);
  await expect(result).toContainText(/ran out/i);

  await limit.fill('4');
  await run.click();
  await expect(result).toHaveAttribute('data-won', 'true');
  await expect(result).toHaveAttribute('data-count', '4');

  await restore.click();
  await expect(limit).toHaveValue('8');
  await expect(result).toHaveAttribute('data-won', 'true');
  await expect(result).toHaveAttribute('data-hash', PROOF_HASH);
  await expect(result).toContainText(PROOF_HASH);

  expect(await snapshot(page), 'local storage is unchanged').toBe(before);
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(SAVED);
  // Only a request of the frame, if any, may have been tried. The control makes none of its own.
  expect(requests.filter((url) => /try|solve|search/i.test(url))).toEqual([]);
});

for (const size of [{ width: 360, height: 640 }, { width: 1280, height: 800 }]) {
  test(`landing at ${size.width}x${size.height}: the turn limit controls follow the layout rules`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('[data-try="result"]').scrollIntoViewIfNeeded();
    const parts = ['limit', 'run', 'restore'];
    const boxes: { id: string; x: number; y: number; w: number; h: number; font: number; fg: string; bg: string }[] = [];
    for (const id of parts) {
      const el = page.locator(`[data-try="${id}"]`);
      await expect(el).toBeVisible();
      boxes.push(
        await el.evaluate((node, name) => {
          const r = node.getBoundingClientRect();
          const s = getComputedStyle(node);
          return { id: name, x: r.x, y: r.y, w: r.width, h: r.height, font: parseFloat(s.fontSize), fg: s.color, bg: s.backgroundColor };
        }, id),
      );
    }
    for (const b of boxes) {
      expect(b.h, `${b.id} height`).toBeGreaterThanOrEqual(44);
      expect(b.w, `${b.id} width`).toBeGreaterThanOrEqual(44);
      expect(b.x, `${b.id} left edge`).toBeGreaterThanOrEqual(16);
      expect(b.x + b.w, `${b.id} right edge`).toBeLessThanOrEqual(size.width - 16);
      expect(b.font, `${b.id} text size`).toBeGreaterThanOrEqual(12);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
        const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
        expect(Math.max(gapX, gapY), `${a.id} and ${b.id} are 12 px apart`).toBeGreaterThanOrEqual(12);
      }
    }
    // Contrast of the text of each control against its own solid colour.
    const lum = (css: string): number => {
      const m = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(css)!;
      const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
        const c = Number(v) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    for (const b of boxes) {
      const [hi, lo] = [lum(b.fg), lum(b.bg)].sort((x, y) => y - x);
      expect((hi! + 0.05) / (lo! + 0.05), `${b.id} contrast`).toBeGreaterThanOrEqual(4.5);
    }
    const text = await page.locator('[data-try-box]').innerText();
    expect(text, 'no dash between words').not.toMatch(/\w\s[-\u2013\u2014]\s\w|\w[-\u2013\u2014]\w/);
  });
}
