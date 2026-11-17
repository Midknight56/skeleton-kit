import { checkControls, type ControlBox } from '@kit/shell';
import type { Page } from '@playwright/test';
import { FRAME_MS, clickItem, control, expect, freezeClock, installClock, runUntilResults, screen, test } from './fixtures';

// Every menu screen of both games sits on a themed card. The heading and the buttons are one block
// inside the card, the card is centred in the screen, and the buttons of one column share one width.
const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 768, height: 1024 },
  { width: 1920, height: 1080 },
];

interface Rect { x: number; y: number; w: number; h: number }
interface Measured {
  card: Rect | null;
  parts: { id: string; rect: Rect }[];
  controls: ControlBox[];
  columns: { widths: number[]; widest: number }[];
  scrolls: boolean;
}

// Measures the card of the open screen. A confirm box is measured through its own card.
async function measure(page: Page, name: string, confirm: boolean): Promise<Measured> {
  return page.evaluate(
    ({ name, confirm }) => {
      const card = document.querySelector<HTMLElement>(confirm ? '[data-dialog="confirm"] [data-card]' : `[data-screen="${name}"][data-card]`);
      const box = (el: Element): { x: number; y: number; w: number; h: number } => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      };
      if (!card) return { card: null, parts: [], controls: [], columns: [], scrolls: false };
      const parts: { id: string; rect: { x: number; y: number; w: number; h: number } }[] = [];
      const controls: { screen: string; id: string; x: number; y: number; w: number; h: number }[] = [];
      for (const el of Array.from(card.querySelectorAll<HTMLElement>('h1, p, ul, [data-stars], [data-control]'))) {
        if (!confirm && el.closest('[data-dialog="confirm"]')) continue;
        if (el.closest('[data-control]') && !el.matches('[data-control]')) continue;
        const id = el.dataset.control ?? el.tagName.toLowerCase();
        parts.push({ id, rect: box(el) });
        if (el.matches('[data-control]')) controls.push({ screen: name, id, ...box(el) });
      }
      const columns = Array.from(card.querySelectorAll<HTMLElement>('[data-column]')).map((column) => {
        const buttons = Array.from(column.querySelectorAll<HTMLElement>('[data-control]'));
        let widest = 0;
        let extra = 0;
        const widths = buttons.map((b) => {
          const range = document.createRange();
          range.selectNodeContents(b);
          const style = getComputedStyle(b);
          extra = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
          widest = Math.max(widest, range.getBoundingClientRect().width);
          return b.getBoundingClientRect().width;
        });
        return { widths, widest: widest + extra };
      });
      const doc = document.scrollingElement as HTMLElement;
      return { card: box(card), parts, controls, columns, scrolls: doc.scrollHeight > window.innerHeight || doc.scrollWidth > window.innerWidth };
    },
    { name, confirm },
  );
}

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5 && inner.x + inner.w <= outer.x + outer.w + 0.5 && inner.y + inner.h <= outer.y + outer.h + 0.5;

const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

async function checkCard(page: Page, name: string, viewport: { width: number; height: number }, confirm = false): Promise<void> {
  const m = await measure(page, name, confirm);
  const where = `${name} at ${viewport.width}x${viewport.height}`;
  expect(m.card, `${where}: the card exists`).not.toBeNull();
  const card = m.card!;
  const problems: string[] = [];

  if (!inside(card, { x: 16, y: 16, w: viewport.width - 32, h: viewport.height - 32 })) {
    problems.push(`the card ${JSON.stringify(card)} is not 16 px inside the screen`);
  }
  const dx = Math.abs(card.x + card.w / 2 - viewport.width / 2);
  const dy = Math.abs(card.y + card.h / 2 - viewport.height / 2);
  if (dx > viewport.width * 0.1) problems.push(`the card centre is ${dx.toFixed(0)} px from the screen centre across, limit ${viewport.width * 0.1}`);
  if (dy > viewport.height * 0.1) problems.push(`the card centre is ${dy.toFixed(0)} px from the screen centre down, limit ${viewport.height * 0.1}`);

  expect(m.parts.length, `${where}: parts found`).toBeGreaterThan(1);
  for (const part of m.parts) if (!inside(part.rect, card)) problems.push(`${part.id} ${JSON.stringify(part.rect)} is not inside the card`);
  for (let i = 0; i < m.parts.length; i++) {
    for (let j = i + 1; j < m.parts.length; j++) {
      if (overlap(m.parts[i]!.rect, m.parts[j]!.rect)) problems.push(`${m.parts[i]!.id} and ${m.parts[j]!.id} overlap`);
    }
  }

  // The heading and the buttons are one block: the block fills the card up to its padding, so there is no
  // empty band between the heading and the first control.
  const heading = m.parts.find((p) => p.id === 'h1');
  const first = m.parts.find((p) => p.id !== 'h1');
  if (heading && first) {
    const between = first.rect.y - (heading.rect.y + heading.rect.h);
    if (between > 120) problems.push(`there are ${between.toFixed(0)} px between the heading and the next part`);
  }

  // Every control of a button column sits in the middle of the card across, also in the confirm boxes.
  // The level buttons are a grid in rows, so they are left out.
  const middle = card.x + card.w / 2;
  for (const c of m.controls.filter((c) => !c.id.startsWith('level-'))) {
    const off = Math.abs(c.x + c.w / 2 - middle);
    if (off > 2) problems.push(`${c.id} is ${off.toFixed(0)} px from the card middle across, limit 2`);
  }

  for (const column of m.columns) {
    const widths = column.widths;
    if (Math.max(...widths) - Math.min(...widths) > 0.5) problems.push(`buttons of one column have widths ${widths.map((w) => w.toFixed(1)).join(', ')}`);
    if (widths.length > 1 && Math.abs(Math.max(...widths) - column.widest) > 1) {
      problems.push(`the column is ${Math.max(...widths).toFixed(1)} px wide, the widest label plus padding is ${column.widest.toFixed(1)}`);
    }
  }
  expect(m.columns.length, `${where}: a column of buttons`).toBeGreaterThan(0);

  problems.push(...checkControls(m.controls, { ...viewport, safe: { top: 0, right: 0, bottom: 0, left: 0 } }));
  if (m.scrolls) problems.push('the page needs scrolling');
  expect(problems, where).toEqual([]);
}

const GAMES = [
  {
    name: 'garden',
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
    test(`${game.name} menu card at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await game.open(page);
      await expect(screen(page, 'title')).toBeVisible();
      await expect(control(page, 'watch')).toBeVisible();
      await checkCard(page, 'title', viewport);

      for (const [id, name] of [['levels', 'levels'], ['how', 'how'], ['credits', 'credits']] as const) {
        await control(page, id).click();
        await expect(screen(page, name)).toBeVisible();
        await checkCard(page, name, viewport);
        await control(page, 'back').click();
      }

      await control(page, 'settings').click();
      await expect(screen(page, 'settings')).toBeVisible();
      await checkCard(page, 'settings', viewport);
      await control(page, 'reset').click();
      await expect(page.locator('[data-dialog="confirm"]')).toBeVisible();
      await checkCard(page, 'settings-confirm', viewport, true);
      await control(page, 'cancel').click();
      await control(page, 'back').click();

      await control(page, 'play').click();
      await expect(screen(page, 'play')).toBeVisible();
      await game.afterPlayStart(page);
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await expect(screen(page, 'pause')).toBeVisible();
      await checkCard(page, 'pause', viewport);
      await control(page, 'retry').click();
      await expect(page.locator('[data-dialog="confirm"]')).toBeVisible();
      await checkCard(page, 'pause-confirm', viewport, true);
      await control(page, 'cancel').click();
      await control(page, 'resume').click();
      await game.afterPlayStart(page);

      await game.toResults(page);
      await expect(screen(page, 'results')).toBeVisible();
      await checkCard(page, 'results', viewport);
    });
  }
}
