import { control, expect, freezeClock, installClock, runToTick, screen, test } from './fixtures';

// The problems three first time testers found on 2026-11-22 (round 4). Each test names the problem it checks.
// The list is docs/acceptance/blind-test-fixes-2026-11-22-r4.md.

const PHONE = { width: 360, height: 640 };
const SIZES = [PHONE, { width: 390, height: 844 }, { width: 1920, height: 1080 }];
const JARGON = /\b(MCP|hash|replay|seed|tool door|tool calls?)\b/i;

for (const size of SIZES) {
  const name = `${size.width}x${size.height}`;

  test(`r4 landing at ${name}: the first two lines say who the kit is for and what it gives, in plain words`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const h1 = page.locator('main h1');
    const who = page.locator('[data-landing="who"]');
    await expect(h1).toBeVisible();
    await expect(who).toBeVisible();
    const first = ((await h1.textContent()) ?? '').trim();
    const second = ((await who.textContent()) ?? '').trim();
    expect(first).toMatch(/game developers/i);
    expect(second).toMatch(/AI coding tool/);
    expect(second).toMatch(/play and test/);
    expect(first, 'line one has no jargon').not.toMatch(JARGON);
    expect(second, 'line two has no jargon').not.toMatch(JARGON);
    const box = (await who.boundingBox())!;
    expect(box.y + box.height, 'both lines are in the first screen').toBeLessThanOrEqual(size.height);
  });

  test(`r4 landing at ${name}: MCP is explained in plain words where it first appears`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const found = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.querySelector('main') as Node, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        if (/\bMCP\b/.test(text)) {
          const block = (node.parentElement as HTMLElement).closest('p, li, header, footer, h1, h2') as HTMLElement;
          return { block: (block.textContent ?? '').replace(/\s+/g, ' '), tag: block.tagName, landing: block.dataset.landing ?? '' };
        }
      }
      return null;
    });
    expect(found, 'the page names MCP').not.toBeNull();
    expect(found!.landing, 'the first MCP is in the intro, not in the code box').not.toBe('');
    expect(found!.block).toMatch(/MCP tool calls, a common way for an AI coding tool to use another program/);
  });

  test(`r4 landing at ${name}: the top play button and the game buttons do not look like the same button`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const background = (selector: string) => page.locator(selector).evaluate((el) => getComputedStyle(el).backgroundColor);
    const top = await background('[data-link="play-now"]');
    const garden = await background('a[data-card="garden"]');
    const runner = await background('a[data-card="runner"]');
    expect(top, 'the top play button and Play Moth Garden').not.toBe(garden);
    expect(garden, 'the two game buttons are one kind of button').toBe(runner);
  });
}

test('r4 landing: the code box explains the short code that the calls show', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.panel footer')).toContainText('new_game starts a level');
  await expect(page.locator('.panel footer')).toContainText(/hash is a short code/i);
});

test('r4 garden how to play: whole sentences that say what each thing does and how to win and lose', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'how').click();
  const items = page.locator('[data-screen="how"] li');
  const texts = (await items.allTextContents()).map((t) => t.trim());
  expect(texts.length).toBeGreaterThanOrEqual(6);
  for (const t of texts) {
    expect(t, t).toMatch(/^[A-Z][^:]*\.$/);
    expect(t.split(/\s+/).length, t).toBeGreaterThanOrEqual(4);
  }
  const all = texts.join(' ').toLowerCase();
  for (const word of ['lantern', 'moth', 'flower', 'hedge', 'web', 'win', 'lost', 'turns']) expect(all, word).toContain(word);
  expect(texts.join(' ')).not.toMatch(/Or switch|Then wait|Tap lantern/);
});

for (const size of [PHONE, SIZES[2]!]) {
  test(`r4 garden how to play at ${size.width}x${size.height}: text is 12 px or more, inside the screen, and Back can be pressed`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/garden/');
    await control(page, 'how').click();
    const card = screen(page, 'how');
    await expect(card).toBeVisible();
    for (const li of await page.locator('[data-screen="how"] li').all()) {
      expect(Number.parseFloat(await li.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
      const b = (await li.boundingBox())!;
      expect(b.x, 'text is 16 px inside the left edge').toBeGreaterThanOrEqual(16);
      expect(b.x + b.width, 'text is 16 px inside the right edge').toBeLessThanOrEqual(size.width - 16);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const back = control(page, 'back');
    await back.scrollIntoViewIfNeeded();
    const b = (await back.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(16);
    expect(b.x + b.width).toBeLessThanOrEqual(size.width - 16);
    expect(b.y + b.height).toBeLessThanOrEqual(size.height);
    await back.click();
    await expect(screen(page, 'title')).toBeVisible();
  });
}

test('r4 garden: the Space key before a lantern is lit gives the same message as the Wait button', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'play').click();
  await expect(screen(page, 'play')).toHaveAttribute('data-hash', /^[0-9a-f]{16}$/);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const before = await screen(page, 'play').getAttribute('data-hash');
  const note = page.locator('[data-hint="refused"]');

  // The key first, with no button in focus, as a player who has just pressed Play.
  await page.keyboard.press(' ');
  await expect(note).toHaveText('Light a lantern first');
  const keyBox = (await note.boundingBox())!;
  await expect(screen(page, 'play')).toHaveAttribute('data-hash', before!);
  expect(await page.evaluate(() => window.scrollY), 'the page did not scroll').toBe(0);
  await note.evaluate((el) => el.remove());

  await control(page, 'wait').click();
  await expect(note).toHaveText('Light a lantern first');
  expect(await note.boundingBox(), 'the key note is in the same place as the button note').toEqual(keyBox);
  await note.evaluate((el) => el.remove());
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  // A move still works after the note, and the note goes away.
  await page.keyboard.press('1');
  await expect(screen(page, 'play')).not.toHaveAttribute('data-hash', before!);
  await expect(note).toHaveCount(0);
});
test('r4 garden level 1: the dark shape is a hedge and the level has no web', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'play').click();
  const canvas = page.locator('[data-screen="play"] canvas');
  await expect(canvas).toHaveAttribute('data-scene', /"id":"hedge-/);
  const ids = ((JSON.parse((await canvas.getAttribute('data-scene')) ?? '[]') as { id: string }[]).map((b) => b.id));
  expect(ids.some((id) => id.startsWith('web-')), 'level 1 has no web').toBe(false);
});

test('r4 runner: a tap on the empty part of the play strip does not jump, a tap in the play area does', async ({ browser }) => {
  const hashAt = async (tap: 'none' | 'strip' | 'canvas'): Promise<string> => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    await installClock(page);
    await page.goto('/runner/');
    await freezeClock(page);
    await control(page, 'play').click();
    await expect(screen(page, 'play')).toBeVisible();
    await runToTick(page, 10);
    if (tap === 'canvas') {
      const area = (await page.locator('[data-screen="play"] canvas').boundingBox())!;
      await page.mouse.click(area.x + area.width / 2, area.y + area.height / 2);
    }
    if (tap === 'strip') {
      const strip = (await page.locator('[data-strip="play"]').boundingBox())!;
      await page.mouse.click(strip.x + strip.width - 24, strip.y + strip.height / 2);
    }
    await runToTick(page, 40);
    const hash = (await screen(page, 'play').getAttribute('data-hash')) ?? '';
    await context.close();
    return hash;
  };
  const quiet = await hashAt('none');
  const tapped = await hashAt('strip');
  const jumped = await hashAt('canvas');
  expect(quiet).toMatch(/^[0-9a-f]{16}$/);
  expect(tapped, 'a tap on the strip changed the run').toBe(quiet);
  expect(jumped, 'the control: a tap in the play area is a jump').not.toBe(quiet);
});
