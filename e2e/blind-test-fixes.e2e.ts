import type { Page } from '@playwright/test';
import { FRAME_MS, clickItem, control, expect, freezeClock, installClock, screen, test } from './fixtures';

// The problems three first time testers found on 2026-11-20. Each test names the problem it checks.
// The list is docs/acceptance/blind-test-fixes-2026-11-20.md.

interface Box { x: number; y: number; w: number; h: number }

const PHONE = { width: 360, height: 640 };
const DESKTOP = { width: 1920, height: 1080 };
const LANDING_SIZES = [PHONE, { width: 390, height: 844 }, { width: 1440, height: 900 }, DESKTOP];

const meets = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// The gap between two boxes, 0 when they touch or overlap.
const gapBetween = (a: Box, b: Box): number => {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.max(dx, dy);
};

// Every line of text of the landing page and every pumpkin of the ground, in page coordinates.
async function textAndPumpkins(page: Page): Promise<{ texts: { text: string; box: Box }[]; pumpkins: Box[] }> {
  return page.evaluate(() => {
    const page = (r: DOMRect) => ({ x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height });
    const texts: { text: string; box: { x: number; y: number; w: number; h: number } }[] = [];
    const walker = document.createTreeWalker(document.querySelector('main') as Node, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      if (text === '') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) if (r.width > 0 && r.height > 0) texts.push({ text: text.slice(0, 48), box: page(r) });
    }
    const pumpkins = Array.from(document.querySelectorAll('svg.ground use')).map((el) => page(el.getBoundingClientRect()));
    return { texts, pumpkins };
  });
}

for (const size of LANDING_SIZES) {
  const name = `${size.width}x${size.height}`;

  test(`landing at ${name}: no pumpkin sits on any text, at the top or the end of the page`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.locator('[data-calls] li')).toHaveCount(3);
    await page.evaluate(() => document.fonts.ready);
    const problems: string[] = [];
    for (const where of ['top', 'end'] as const) {
      await page.evaluate((w) => window.scrollTo(0, w === 'top' ? 0 : document.documentElement.scrollHeight), where);
      const m = await textAndPumpkins(page);
      expect(m.pumpkins.length, 'the ground has pumpkins').toBeGreaterThan(0);
      for (const p of m.pumpkins) for (const t of m.texts) if (meets(p, t.box)) problems.push(`${where}: a pumpkin covers "${t.text}"`);
    }
    expect(problems).toEqual([]);
  });

  test(`landing at ${name}: the ground ends the page, with no empty band under the last text`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.locator('[data-calls] li')).toHaveCount(3);
    const m = await page.evaluate(() => {
      const r = (document.querySelector('svg.ground') as Element).getBoundingClientRect();
      const doc = document.scrollingElement as HTMLElement;
      const main = document.querySelector('main') as HTMLElement;
      let last = 0;
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if ((node.textContent ?? '').trim() === '') continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        last = Math.max(last, range.getBoundingClientRect().bottom + window.scrollY);
      }
      return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, height: r.height, page: doc.scrollHeight, lastText: last };
    });
    expect(m.bottom, 'the ground reaches the end of the page').toBeGreaterThanOrEqual(m.page - 1);
    expect(m.top, 'the ground starts under the last text').toBeGreaterThanOrEqual(m.lastText);
    // Under the last text there is only the usual space before the ground: no empty band.
    expect(m.top - m.lastText, 'empty space between the last text and the ground').toBeLessThanOrEqual(80);
  });
}

for (const size of [PHONE, { width: 1440, height: 900 }, DESKTOP]) {
  test(`landing at ${size.width}x${size.height}: the first screen says in plain words what MCP tool calls are and what a game maker does`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const what = page.locator('[data-landing="what"]');
    await expect(what).toBeVisible();
    const text = (await what.textContent()) ?? '';
    expect(text).toContain('MCP');
    expect(text).toMatch(/AI coding tool/);
    expect(text).toMatch(/you (write|make)/i);
    const box = (await what.boundingBox())!;
    expect(box.y + box.height, 'the sentence is in the first screen').toBeLessThanOrEqual(size.height);
    // The box of calls names what each of the five tools does.
    const foot = (await page.locator('.panel footer').textContent()) ?? '';
    for (const tool of ['new_game', 'act', 'observe', 'render', 'replay']) expect(foot, tool).toMatch(new RegExp(`${tool} \\w+`));
  });
}

test('landing: the legend says which colour is a person playing and which is a program', async ({ page }) => {
  await page.goto('/');
  const items = await page.locator('.key li').allTextContents();
  expect(items).toHaveLength(2);
  expect(items[0]).toMatch(/orange/i);
  expect(items[0]).toMatch(/\byou\b/i);
  expect(items[1]).toMatch(/pink/i);
  expect(items[1]).toMatch(/program/i);
});

for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }, DESKTOP]) {
  // A link to a part of the page that is already wholly in view does nothing a person can see.
  test(`landing at ${size.width}x${size.height}: every link to a part of the page shows something that was not in view`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.locator('[data-calls] li')).toHaveCount(3);
    const count = await page.locator('main a[href^="#"]').count();
    expect(count).toBeGreaterThan(0);
    const still: string[] = [];
    for (let i = 0; i < count; i++) {
      await page.evaluate(() => window.scrollTo(0, 0));
      const link = page.locator('main a[href^="#"]').nth(i);
      await link.scrollIntoViewIfNeeded();
      const href = (await link.getAttribute('href')) ?? '';
      const inView = await page.evaluate((id) => {
        const r = (document.getElementById(id.slice(1)) as HTMLElement).getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight;
      }, href);
      const before = await page.evaluate(() => window.scrollY);
      await link.click();
      await page.waitForTimeout(100);
      const after = await page.evaluate(() => window.scrollY);
      if (inView || after === before) still.push(`${(await link.textContent())?.trim()} (${href})`);
    }
    expect(still, 'links that do nothing you can see').toEqual([]);
  });
}

test('garden: a real mouse click on Play starts level 1', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/garden/');
  const play = control(page, 'play');
  await expect(play).toBeVisible();
  const box = (await play.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(screen(page, 'play')).toBeVisible();
  await expect(screen(page, 'play')).toHaveAttribute('data-tick', '0');
});

async function chips(page: Page): Promise<{ id: string; box: Box }[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-hint]')).map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.hint as string, box: { x: r.left, y: r.top, w: r.width, h: r.height } };
    }),
  );
}

async function itemBox(page: Page, id: string): Promise<Box> {
  const canvas = page.locator('[data-screen="play"] canvas');
  await expect(canvas).toHaveAttribute('data-scene', new RegExp(`"id":"${id}"`));
  const items = JSON.parse((await canvas.getAttribute('data-scene')) ?? '[]') as ({ id: string } & Box)[];
  const item = items.find((i) => i.id === id)!;
  const area = (await canvas.boundingBox())!;
  return { x: area.x + item.x, y: area.y + item.y, w: item.w, h: item.h };
}

for (const size of [PHONE, DESKTOP]) {
  test(`garden level 1 at ${size.width}x${size.height}: one chip at a time, first Tap lantern beside lantern 1, then Then wait`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/garden/');
    await control(page, 'play').click();
    await expect(page.locator('[data-hint]').first()).toBeVisible();
    const first = await chips(page);
    expect(first.map((c) => c.id)).toEqual(['tap-lantern']);
    const lantern = await itemBox(page, 'lantern-1');
    expect(gapBetween(first[0]!.box, lantern), 'the chip sits beside its lantern').toBeLessThanOrEqual(12);

    await clickItem(page, 'lantern-1');
    await expect(screen(page, 'play')).toHaveAttribute('data-tick', '1');
    await expect(page.locator('[data-hint="wait-turn"]')).toBeVisible();
    const second = await chips(page);
    expect(second.map((c) => c.id)).toEqual(['wait-turn']);
    const wait = (await control(page, 'wait').boundingBox())!;
    expect(gapBetween(second[0]!.box, { x: wait.x, y: wait.y, w: wait.width, h: wait.height })).toBeLessThanOrEqual(12);
  });
}

test('garden: Wait with no lit lantern says why, and the Wait button looks unavailable until a lantern is lit', async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('kit.garden.v1')) {
      window.localStorage.setItem('kit.garden.v1', JSON.stringify({ version: 1, levels: { g01: { stars: 3, best: 2 } }, settings: { sound: false, music: false, usage: false }, lessons: {} }));
    }
  });
  await page.goto('/garden/');
  await control(page, 'levels').click();
  await control(page, 'level-g02').click();
  await expect(screen(page, 'play')).toBeVisible();
  const wait = control(page, 'wait');
  await expect(wait).toHaveAttribute('data-blocked', 'true');
  // The kit marks a button that cannot be used now with a dashed border, as it does for a disabled one.
  // The text keeps its full colour, so it stays readable.
  expect(await wait.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('dashed');
  await wait.click();
  const note = page.locator('[data-hint="refused"]');
  await expect(note).toBeVisible();
  await expect(note).toHaveText('Light a lantern first');
  expect(Number.parseFloat(await note.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
  await expect(screen(page, 'play')).toHaveAttribute('data-tick', '0');

  await clickItem(page, 'lantern-1');
  await expect(screen(page, 'play')).toHaveAttribute('data-tick', '1');
  await expect(wait).toHaveAttribute('data-blocked', 'false');
  await expect(note).toHaveCount(0);
});

test('settings: each switch shows on or off in words, and the word changes with the switch', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'settings').click();
  const word = (id: string) => control(page, id).evaluate((el) => getComputedStyle(el, '::after').content);
  for (const id of ['sound', 'music', 'usage']) {
    const pressed = await control(page, id).getAttribute('aria-pressed');
    expect(await word(id), id).toBe(pressed === 'true' ? '": on"' : '": off"');
  }
  await control(page, 'sound').click();
  await expect(control(page, 'sound')).toHaveAttribute('aria-pressed', 'false');
  expect(await word('sound')).toBe('": off"');
});

test('levels: a locked level says how to open it', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'levels').click();
  await expect(control(page, 'level-g02')).toHaveAttribute('data-locked', 'true');
  const note = page.locator('[data-screen="levels"] [data-locks]');
  await expect(note).toBeVisible();
  await expect(note).toHaveText('Win a level to open the next one.');
});

for (const game of [
  { id: 'garden', stars: /3 stars/, lost: /lost/i },
  { id: 'runner', stars: /3 stars/, lost: /ends the run/i },
]) {
  test(`${game.id} how to play: it says how to get 3 stars and how a level is lost`, async ({ page }) => {
    await page.goto(`/${game.id}/`);
    await control(page, 'how').click();
    const lines = await page.locator('[data-screen="how"] li').allTextContents();
    expect(lines.some((l) => game.stars.test(l)), lines.join(' | ')).toBe(true);
    expect(lines.some((l) => game.lost.test(l)), lines.join(' | ')).toBe(true);
  });
}

test('runner level 1: the Tap jump chip stays on screen while the run goes on, until the first jump', async ({ page }) => {
  await installClock(page);
  await page.goto('/runner/');
  await freezeClock(page);
  await control(page, 'play').click();
  await expect(screen(page, 'play')).toBeVisible();
  await page.clock.runFor(60 * FRAME_MS);
  expect(Number(await screen(page, 'play').getAttribute('data-tick'))).toBeGreaterThan(30);
  await expect(page.locator('[data-hint="jump"]')).toBeVisible();
  await page.keyboard.press(' ');
  await page.clock.runFor(4 * FRAME_MS);
  await expect(page.locator('[data-hint="jump"]')).toHaveCount(0);
});
