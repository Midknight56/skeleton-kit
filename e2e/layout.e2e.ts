import { checkControls, type ControlBox, type Rect } from '@kit/shell';
import type { Page } from '@playwright/test';
import { FRAME_MS, clickItem, control, expect, freezeClock, installClock, runUntilResults, screen, test } from './fixtures';

// Requirement 6.4: every screen at seven viewports. The boxes come from the real page.
const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];

const TEXT_PADDING = 8;

interface Measured { boxes: ControlBox[]; playArea: Rect | null; paddingProblems: string[]; scrolls: boolean }

// Measures the controls of the open screen. `within` limits the search to one element.
async function measure(page: Page, name: string, within?: string): Promise<Measured> {
  return page.evaluate(
    ({ name, within, pad }) => {
      const scope = within ? document.querySelector(within) : document;
      const boxes: { screen: string; id: string; x: number; y: number; w: number; h: number }[] = [];
      const paddingProblems: string[] = [];
      for (const el of Array.from(scope?.querySelectorAll<HTMLElement>('[data-control]') ?? [])) {
        if (within === undefined && el.closest('[data-dialog="confirm"]')) continue;
        const r = el.getBoundingClientRect();
        const id = el.dataset.control as string;
        boxes.push({ screen: name, id, x: r.left, y: r.top, w: r.width, h: r.height });
        const range = document.createRange();
        range.selectNodeContents(el);
        const t = range.getBoundingClientRect();
        if (t.width > 0 && t.height > 0) {
          const gaps = { left: t.left - r.left, right: r.right - t.right, top: t.top - r.top, bottom: r.bottom - t.bottom };
          for (const [side, gap] of Object.entries(gaps)) {
            if (gap < pad - 0.5) paddingProblems.push(`${name}: ${id} has ${gap.toFixed(1)} px between its text and its ${side} edge, minimum is ${pad}`);
          }
        }
      }
      const canvas = document.querySelector('canvas');
      const c = canvas?.getBoundingClientRect();
      const doc = document.scrollingElement as HTMLElement;
      return {
        boxes,
        playArea: c ? { x: c.left, y: c.top, w: c.width, h: c.height } : null,
        paddingProblems,
        scrolls: doc.scrollHeight > window.innerHeight || doc.scrollWidth > window.innerWidth,
      };
    },
    { name, within, pad: TEXT_PADDING },
  );
}

async function check(page: Page, name: string, viewport: { width: number; height: number }, within?: string): Promise<void> {
  const m = await measure(page, name, within);
  expect(m.boxes.length, `${name}: controls found`).toBeGreaterThan(0);
  const problems = [
    ...checkControls(m.boxes, { ...viewport, safe: { top: 0, right: 0, bottom: 0, left: 0 } }, m.playArea ?? undefined),
    ...m.paddingProblems,
    ...(m.scrolls ? [`${name}: the page needs scrolling`] : []),
  ];
  expect(problems, `layout at ${viewport.width}x${viewport.height}`).toEqual([]);
}

// Each game gets to its results screen in its own way. The garden puzzle is won in two actions.
// The runner is a tick game, so its clock is a fake one that the test moves by hand.
const GAMES = [
  {
    name: 'garden',
    path: '/garden/',
    async open(page: Page): Promise<void> {
      await page.goto('/garden/');
    },
    async afterPlayStart(): Promise<void> {},
    async toResults(page: Page): Promise<void> {
      await clickItem(page, 'lantern-1');
      await control(page, 'wait').click();
    },
  },
  {
    name: 'runner',
    path: '/runner/',
    async open(page: Page): Promise<void> {
      await installClock(page);
      await page.goto('/runner/');
      await freezeClock(page);
    },
    async afterPlayStart(page: Page): Promise<void> {
      await page.clock.runFor(2 * FRAME_MS);
    },
    async toResults(page: Page): Promise<void> {
      await runUntilResults(page);
    },
  },
];

for (const game of GAMES) {
  for (const viewport of VIEWPORTS) {
    test(`${game.name} layout at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await game.open(page);
      await expect(screen(page, 'title')).toBeVisible();
      // The watch button shows when the proof index has loaded.
      await expect(control(page, 'watch')).toBeVisible();
      await check(page, 'title', viewport);

      await control(page, 'levels').click();
      await expect(screen(page, 'levels')).toBeVisible();
      await check(page, 'levels', viewport);
      await control(page, 'back').click();

      await control(page, 'how').click();
      await expect(screen(page, 'how')).toBeVisible();
      await check(page, 'how', viewport);
      await control(page, 'back').click();

      await control(page, 'credits').click();
      await expect(screen(page, 'credits')).toBeVisible();
      await check(page, 'credits', viewport);
      await control(page, 'back').click();

      await control(page, 'settings').click();
      await expect(screen(page, 'settings')).toBeVisible();
      await check(page, 'settings', viewport);
      await control(page, 'reset').click();
      await expect(page.locator('[data-dialog="confirm"]')).toBeVisible();
      await check(page, 'settings-confirm', viewport, '[data-dialog="confirm"]');
      await control(page, 'cancel').click();
      await control(page, 'back').click();

      await control(page, 'watch').click();
      await expect(screen(page, 'watch')).toBeVisible();
      await expect(page.locator('[data-proof="line"]')).toBeVisible();
      await check(page, 'watch', viewport);
      await control(page, 'back').click();

      await control(page, 'play').click();
      await expect(screen(page, 'play')).toBeVisible();
      await game.afterPlayStart(page);
      await check(page, 'play', viewport);

      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await expect(screen(page, 'pause')).toBeVisible();
      await check(page, 'pause', viewport);
      await control(page, 'resume').click();
      await game.afterPlayStart(page);

      await game.toResults(page);
      await expect(screen(page, 'results')).toBeVisible();
      await check(page, 'results', viewport);
    });
  }
}