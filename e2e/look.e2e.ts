import { checkControls, type ControlBox } from '@kit/shell';
import type { Page } from '@playwright/test';
import { control, expect, screen, test } from './fixtures';

// The look: on the landing page and on the title screen of both games the scene fills the screen, the
// rail is at the top, the controls keep the spacing rules, decoration ignores the pointer, the fonts come
// from this site, and no request goes to another host.
const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 768, height: 1024 },
  { width: 1920, height: 1080 },
];

const ORIGIN = 'http://127.0.0.1:4173';

// Records every request of the page and its frames, and the status of every font file.
function watchRequests(page: Page): { hosts: () => string[]; fonts: () => { url: string; status: number }[] } {
  const hosts = new Set<string>();
  const fonts: { url: string; status: number }[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:' || url.protocol === 'about:') return;
    hosts.add(url.host);
  });
  page.on('response', (response) => {
    if (response.url().endsWith('.ttf')) fonts.push({ url: response.url(), status: response.status() });
  });
  return { hosts: () => [...hosts], fonts: () => fonts };
}

interface Rect { x: number; y: number; w: number; h: number }

async function rectOf(page: Page, selector: string): Promise<Rect | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
  }, selector);
}

// The sky covers the whole screen and the rail runs along the top.
async function expectScene(page: Page, viewport: { width: number; height: number }, sky: string, rail: string): Promise<void> {
  const backdrop = await rectOf(page, sky);
  expect(backdrop, `${sky} has a box`).not.toBeNull();
  expect(backdrop).toEqual({ x: 0, y: 0, w: viewport.width, h: viewport.height });
  const bar = await rectOf(page, rail);
  expect(bar, `${rail} has a box`).not.toBeNull();
  expect(bar!.x).toBe(0);
  expect(bar!.y).toBe(0);
  expect(bar!.w).toBe(viewport.width);
  expect(bar!.h).toBeGreaterThanOrEqual(10);
  expect(bar!.h).toBeLessThanOrEqual(16);
  const events = await page.evaluate(
    ([a, b]) => [a, b].map((sel) => getComputedStyle(document.querySelector(sel as string) as Element).pointerEvents),
    [sky, rail],
  );
  expect(events).toEqual(['none', 'none']);
}

// Every control of the page, measured on the page as a whole, so a page that scrolls is measured to its end.
async function measureControls(page: Page, selector: string, name: string): Promise<{ boxes: ControlBox[]; scrollWidth: number; scrollHeight: number }> {
  return page.evaluate(
    ({ selector, name }) => {
      const boxes = Array.from(document.querySelectorAll<HTMLElement>(selector))
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { screen: name, id: el.dataset.control ?? el.dataset.card ?? el.dataset.link ?? el.textContent?.trim().slice(0, 24) ?? el.tagName, x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
        });
      const doc = document.scrollingElement as HTMLElement;
      return { boxes, scrollWidth: doc.scrollWidth, scrollHeight: doc.scrollHeight };
    },
    { selector, name },
  );
}

// Nothing covers a control: the element at its middle is the control or part of it.
async function expectUncovered(page: Page, selector: string): Promise<void> {
  const count = await page.locator(selector).count();
  for (let i = 0; i < count; i++) {
    const item = page.locator(selector).nth(i);
    if (!(await item.isVisible())) continue;
    await item.scrollIntoViewIfNeeded();
    const ok = await item.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top === el || el.contains(top);
    });
    expect(ok, `${selector} #${i} is covered`).toBe(true);
  }
}

async function expectFonts(page: Page, fonts: () => { url: string; status: number }[]): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.load('700 16px "Bricolage Grotesque"');
    await document.fonts.load('500 14px "Sometype Mono"');
  });
  const seen = fonts();
  expect(seen.map((f) => f.url.split('/').pop()).sort()).toEqual(expect.arrayContaining(['BricolageGrotesque.ttf', 'SometypeMono.ttf']));
  for (const font of seen) {
    expect(font.status, font.url).toBe(200);
    expect(font.url.startsWith(`${ORIGIN}/fonts/`), font.url).toBe(true);
  }
  expect(await page.evaluate(() => document.fonts.check('700 16px "Bricolage Grotesque"') && document.fonts.check('500 14px "Sometype Mono"'))).toBe(true);
}

for (const viewport of VIEWPORTS) {
  const size = `${viewport.width}x${viewport.height}`;

  test(`landing page at ${size}: the scene fills the screen, the controls keep the spacing, nothing leaves the site`, async ({ page }) => {
    const requests = watchRequests(page);
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('iframe[data-frame="watch"]')).toBeVisible();
    await expect(page.locator('[data-calls] li')).toHaveCount(3);
    await expectScene(page, viewport, '.sky', '.rail');

    const m = await measureControls(page, 'main a', 'landing');
    expect(m.boxes.length).toBeGreaterThanOrEqual(7);
    expect(m.scrollWidth, 'no sideways scroll').toBeLessThanOrEqual(viewport.width);
    expect(checkControls(m.boxes, { width: viewport.width, height: m.scrollHeight, safe: { top: 0, right: 0, bottom: 0, left: 0 } })).toEqual([]);
    await expectUncovered(page, 'main a');
    // The pictures behind the page ignore the pointer.
    expect(await page.evaluate(() => ['.sky', '.ground', '.rail', '.moon'].map((s) => { const el = document.querySelector(s); return el ? getComputedStyle(el).pointerEvents : 'none'; }))).toEqual(['none', 'none', 'none', 'none']);

    await expectFonts(page, requests.fonts);
    expect(requests.hosts()).toEqual(['127.0.0.1:4173']);
  });

  for (const game of ['garden', 'runner'] as const) {
    test(`${game} title at ${size}: the scene fills the screen, the controls keep the spacing, nothing leaves the site`, async ({ page }) => {
      const requests = watchRequests(page);
      await page.setViewportSize(viewport);
      await page.goto(`/${game}/`);
      await expect(screen(page, 'title')).toBeVisible();
      await expectScene(page, viewport, '[data-backdrop]', '[data-rail]');
      await expect(page.locator('[data-backdrop]')).toHaveAttribute('data-look', 'title');

      // The title screen is the whole screen, and its art is the one that fits the shape of the screen.
      const title = await rectOf(page, '[data-screen="title"]');
      expect(title!.x).toBe(0);
      expect(title!.w).toBe(viewport.width);
      expect(title!.h).toBeGreaterThanOrEqual(viewport.height);
      await expect(page.locator(viewport.width > viewport.height * 1.25 ? '[data-art="wide"]' : '[data-art="narrow"]')).toBeVisible();
      await expect(page.locator(viewport.width > viewport.height * 1.25 ? '[data-art="narrow"]' : '[data-art="wide"]')).toBeHidden();

      const m = await measureControls(page, '[data-screen="title"] [data-control]', 'title');
      expect(m.boxes.map((b) => b.id)).toEqual(['play', 'watch', 'levels', 'how', 'settings', 'credits']);
      expect(m.scrollWidth, 'no sideways scroll').toBeLessThanOrEqual(viewport.width);
      const widths = m.boxes.map((b) => b.w);
      expect(Math.max(...widths) - Math.min(...widths), 'the signs share one width').toBeLessThanOrEqual(0.5);
      expect(checkControls(m.boxes, { width: viewport.width, height: m.scrollHeight, safe: { top: 0, right: 0, bottom: 0, left: 0 } })).toEqual([]);
      await expectUncovered(page, '[data-screen="title"] [data-control]');

      // The garland is a picture: hidden from the reader, no pointer, and never under a control.
      if (game === 'garden') {
        const garland = await rectOf(page, '[data-garland]');
        const shown = viewport.width >= 700 && viewport.height >= 640;
        if (shown) {
          expect(garland).not.toBeNull();
          expect(garland!.y + garland!.h).toBeLessThanOrEqual(m.scrollHeight);
          for (const b of m.boxes) expect(b.y + b.h, `${b.id} is above the garland`).toBeLessThanOrEqual(garland!.y);
          await expect(page.locator('[data-garland-item]')).toHaveCount(12);
          await expect(page.locator('[data-garland-item][data-ring="true"]')).toHaveCount(1);
          await expect(page.locator('[data-garland-item]').first()).toHaveAttribute('data-ring', 'true');
          await expect(page.locator('[data-garland]')).toContainText('next: level 1 of 12');
          expect(await page.locator('[data-garland]').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
          await expect(page.locator('[data-garland]')).toHaveAttribute('aria-hidden', 'true');
          expect(await page.locator('[data-garland] button, [data-garland] a, [data-garland] [tabindex]').count()).toBe(0);
        } else {
          await expect(page.locator('[data-garland]')).toBeHidden();
        }
      } else {
        await expect(page.locator('[data-garland]')).toHaveCount(0);
      }

      // The play screen keeps the same sky and rail.
      await control(page, 'play').click();
      await expect(screen(page, 'play')).toBeVisible();
      await expect(page.locator('[data-backdrop]')).toHaveAttribute('data-look', 'play');
      await expectScene(page, viewport, '[data-backdrop]', '[data-rail]');

      await expectFonts(page, requests.fonts);
      expect(requests.hosts()).toEqual(['127.0.0.1:4173']);
    });
  }
}

test('landing page: the call that runs follows the real watch screen in the frame', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => {
    const w = window as unknown as { __seen: string[] };
    w.__seen = [];
    const read = () => {
      const running = document.querySelector<HTMLElement>('[data-calls] li[data-running="true"]')?.dataset.call;
      if (running && w.__seen[w.__seen.length - 1] !== running) w.__seen.push(running);
    };
    new MutationObserver(read).observe(document, { subtree: true, attributes: true, childList: true });
  });
  await page.goto('/');
  const inner = page.frameLocator('iframe[data-frame="watch"]');
  await expect(inner.locator('[data-screen="watch"]')).toBeVisible();
  // One call is marked at a time.
  await expect(page.locator('[data-calls] li[data-running="true"]')).toHaveCount(1, { timeout: 15_000 });
  // The watch run goes new_game, then act while it plays, then replay at its end, as the frame shows.
  await expect
    .poll(async () => page.evaluate(() => (window as unknown as { __seen: string[] }).__seen.join(',')), { timeout: 20_000 })
    .toMatch(/^new_game,act,replay/);
  await expect(page.locator('[data-count]')).toHaveText(/action \d of 4/);
  // The mark never runs ahead of the frame: when the frame shows tick n, the page shows action n or later.
  const tick = Number(await inner.locator('[data-screen="watch"]').getAttribute('data-tick'));
  const shown = Number(/action (\d)/.exec((await page.locator('[data-count]').textContent()) ?? '')?.[1]);
  expect(Math.abs(shown - tick)).toBeLessThanOrEqual(1);
});
