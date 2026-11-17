import type { Frame, Page } from '@playwright/test';
import { gameConfig as gardenConfig } from '../apps/garden/game.config';
import { gameConfig as runnerConfig } from '../apps/runner/game.config';
import { clickItem, control, expect, levelIds, screen, test } from './fixtures';

// The parts of the game shell that every game gets: loading screen, page title, pause confirms, the
// usage data switch and its privacy link, the watch proof row, menu sizes and the garden board edge.

const SIZES = [
  { width: 360, height: 640 },
  { width: 768, height: 1024 },
  { width: 1920, height: 1080 },
];

const GAMES = [
  { name: 'garden', path: '/garden/', title: gardenConfig.title, background: 'rgb(27, 22, 54)' },
  { name: 'runner', path: '/runner/', title: runnerConfig.title, background: 'rgb(14, 26, 51)' },
];

interface Box { x: number; y: number; w: number; h: number }

const intersects = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

for (const game of GAMES) {
  test(`${game.name}: the loading screen shows the name in the game colours, then the title screen replaces it`, async ({ page }) => {
    // Hold the script back, so the page is seen as it is before the script runs.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/assets\/[^/]+\.js$/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto(game.path, { waitUntil: 'commit' });
    const loading = page.locator('[data-screen="loading"]');
    await expect(loading).toBeVisible();
    await expect(loading).toContainText(game.title);
    const look = await page.evaluate(() => {
      const cue = document.querySelector('[data-screen="loading"] .cue span') as HTMLElement;
      return { body: getComputedStyle(document.body).backgroundColor, animation: getComputedStyle(cue).animationName };
    });
    expect(look.body).toBe(game.background);
    expect(look.animation).toBe('loading-pulse');
    await expect(screen(page, 'title')).toHaveCount(0);

    release();
    await expect(screen(page, 'title')).toBeVisible();
    await expect(loading).toHaveCount(0);
    expect(await page.title()).toBe(game.title);
  });
}

test('garden: usage data off is kept after a reload, a level plays, and no request leaves the site', async ({ page }) => {
  // The built site has no beacon url, so the beacon could not send in any case. This test checks that the
  // switch is kept and that the page makes no request to any other address and calls no sendBeacon.
  // The proof that the switch stops a beacon that has a url is the unit test in kit/shell/src/mount.test.ts.
  await page.addInitScript(() => {
    const w = window as unknown as { __beacons: number };
    w.__beacons = 0;
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: () => {
        w.__beacons += 1;
        return true;
      },
    });
  });
  await page.goto('/garden/');
  await control(page, 'settings').click();
  const usage = control(page, 'usage');
  await expect(usage).toHaveText('Usage data');
  await expect(usage).toHaveAttribute('aria-pressed', 'true');
  await usage.click();
  await expect(usage).toHaveAttribute('aria-pressed', 'false');

  const outside: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4173') {
      outside.push(url.href);
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.reload();
  await control(page, 'settings').click();
  await expect(control(page, 'usage')).toHaveAttribute('aria-pressed', 'false');
  await control(page, 'back').click();
  await control(page, 'play').click();
  await clickItem(page, 'lantern-1');
  await control(page, 'wait').click();
  await expect(screen(page, 'results')).toHaveAttribute('data-phase', 'won');
  expect(outside).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __beacons: number }).__beacons)).toBe(0);
});

test('garden: the Privacy link of the settings opens the privacy page in the same tab', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'settings').click();
  const link = control(page, 'privacy');
  await expect(link).toHaveText('Privacy');
  await expect(link).toHaveAttribute('href', '../privacy/');
  await link.click();
  await expect(page).toHaveURL(/\/privacy\/$/);
  await expect(page.locator('h1')).toHaveText('Privacy');
  expect(page.context().pages().length).toBe(1);
});

test('garden: Retry and Levels on the pause screen ask first, with the focus on Stay', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'play').click();
  await clickItem(page, 'lantern-1');
  await expect(screen(page, 'play')).toHaveAttribute('data-tick', '1');
  await control(page, 'pause').click();
  const box = page.locator('[data-dialog="confirm"]');

  // Retry, then Escape: the run stays.
  await control(page, 'retry').click();
  await expect(box).toBeVisible();
  await expect(box).toContainText('Leave this run?');
  await expect(box.locator('[data-control="confirm"]')).toHaveText('Leave');
  await expect(box.locator('[data-control="cancel"]')).toHaveText('Stay');
  await expect(box.locator('[data-control="cancel"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(box).toHaveCount(0);
  await expect(screen(page, 'pause')).toBeVisible();

  // Levels, then Stay, then Resume: the run goes on where it was.
  await control(page, 'levels').click();
  await control(page, 'cancel').click();
  await expect(box).toHaveCount(0);
  await control(page, 'resume').click();
  await expect(screen(page, 'play')).toHaveAttribute('data-tick', '1');
});

// The white pixels of the canvas in the band above the board: the HUD text of the game.
async function hudAndProof(target: Page | Frame): Promise<{ proof: Box; hud: Box | null }> {
  return target.evaluate(() => {
    const line = document.querySelector('[data-proof="line"]') as HTMLElement;
    const p = line.getBoundingClientRect();
    const canvas = document.querySelector('[data-screen="watch"] canvas') as HTMLCanvasElement;
    const c = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const sx = c.width / canvas.width;
    const sy = c.height / canvas.height;
    // The HUD line is in the top bar of the scene, which is 56 px high and starts 8 px below the proof row.
    const band = Math.min(canvas.height, Math.ceil((p.bottom + 8 + 56 - c.top) / sy));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < band; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255 && data[i + 3] === 255) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + 1);
          maxY = Math.max(maxY, y + 1);
        }
      }
    }
    return {
      proof: { x: p.left, y: p.top, w: p.width, h: p.height },
      hud: maxX < 0 ? null : { x: c.left + minX * sx, y: c.top + minY * sy, w: (maxX - minX) * sx, h: (maxY - minY) * sy },
    };
  });
}

for (const game of GAMES) {
  for (const size of SIZES) {
    test(`${game.name} watch at ${size.width}x${size.height}: the proof line and the HUD text do not meet`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(game.path);
      await control(page, 'watch').click();
      await expect(page.locator('[data-proof="line"]')).toBeVisible();
      await expect(page.locator('[data-screen="watch"] canvas')).toHaveAttribute('data-scene', /"id":/);
      const m = await hudAndProof(page);
      expect(m.hud, 'the HUD text was found').not.toBeNull();
      expect(intersects(m.proof, m.hud!), `proof ${JSON.stringify(m.proof)} and HUD ${JSON.stringify(m.hud)}`).toBe(false);
    });
  }
}

for (const size of SIZES) {
  test(`landing page at ${size.width}x${size.height}: the proof line and the HUD text in the watch frame do not meet`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const inner = page.frameLocator('iframe[data-frame="watch"]');
    await expect(inner.locator('[data-proof="line"]')).toBeVisible();
    await expect(inner.locator('[data-screen="watch"] canvas')).toHaveAttribute('data-scene', /"id":/);
    const frame = page.frames().find((f) => f.url().includes('/garden/'));
    expect(frame, 'the watch frame').toBeDefined();
    const m = await hudAndProof(frame!);
    expect(m.hud, 'the HUD text was found').not.toBeNull();
    expect(intersects(m.proof, m.hud!), `proof ${JSON.stringify(m.proof)} and HUD ${JSON.stringify(m.hud)}`).toBe(false);
  });
}

test('garden watch: the turn buttons shown as copies look dimmer than a live button', async ({ page }) => {
  await page.goto('/garden/');
  await control(page, 'watch').click();
  await expect(screen(page, 'watch')).toBeVisible();
  const look = await page.evaluate(() => {
    const opacity = (id: string) => Number(getComputedStyle(document.querySelector(`[data-control="${id}"]`) as HTMLElement).opacity);
    return { copy: opacity('wait'), live: opacity('back'), disabled: (document.querySelector('[data-control="wait"]') as HTMLButtonElement).disabled };
  });
  expect(look.disabled).toBe(true);
  expect(look.live).toBe(1);
  expect(look.copy).toBeLessThanOrEqual(0.5);
});

// The menu column of a screen: the heading and the controls under it.
async function column(page: Page): Promise<{ heading: Box; controls: Box[]; group: { top: number; bottom: number }; font: number; bottom: number }> {
  return page.evaluate(() => {
    const root = document.querySelector('[data-kit-root] > [data-screen]') as HTMLElement;
    const r = (el: Element) => {
      const b = el.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height };
    };
    const controls = Array.from(root.querySelectorAll<HTMLElement>('[data-control]')).filter((el) => !el.closest('[data-dialog]'));
    const first = controls[0] as HTMLElement;
    const style = getComputedStyle(root);
    // Everything under the heading: text, tiles and controls, but not a confirm box.
    const parts = Array.from(root.children).filter((el) => el.tagName !== 'H1' && !el.matches('[data-dialog]')).map((el) => el.getBoundingClientRect());
    return {
      heading: r(root.querySelector('h1') as HTMLElement),
      controls: controls.map(r),
      group: { top: Math.min(...parts.map((p) => p.top)), bottom: Math.max(...parts.map((p) => p.bottom)) },
      font: Number.parseFloat(getComputedStyle(first).fontSize),
      bottom: root.getBoundingClientRect().bottom - Number.parseFloat(style.paddingBottom),
    };
  });
}

for (const game of GAMES) {
  test(`${game.name} at 1920x1080: menu text and buttons are large, and the column is centred below the heading`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(game.path);
    await expect(control(page, 'watch')).toBeVisible();
    const play = await control(page, 'play').boundingBox();
    expect(play!.height, 'Play button height').toBeGreaterThanOrEqual(56);
    const font = await control(page, 'play').evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    expect(font, 'Play text size').toBeGreaterThanOrEqual(24);

    const problems: string[] = [];
    const checkColumn = async (name: string) => {
      const m = await column(page);
      if (m.font < 24) problems.push(`${name}: text is ${m.font} px, minimum 24`);
      for (const c of m.controls) if (c.h < 56) problems.push(`${name}: a control is ${c.h} px high, minimum 56`);
      const centre = (m.group.top + m.group.bottom) / 2;
      const spaceCentre = (m.heading.y + m.heading.h + m.bottom) / 2;
      if (Math.abs(centre - spaceCentre) > 16) problems.push(`${name}: the column centre is ${(centre - spaceCentre).toFixed(1)} px from the centre of the space below the heading`);
    };
    await checkColumn('title');
    for (const name of ['levels', 'how', 'settings', 'credits']) {
      await control(page, name).click();
      await expect(screen(page, name)).toBeVisible();
      await checkColumn(name);
      if (name === 'settings') {
        await control(page, 'reset').click();
        const box = await page.locator('[data-dialog="confirm"] [data-control="cancel"]').boundingBox();
        if (box!.height < 56) problems.push(`settings confirm: Keep is ${box!.height} px high, minimum 56`);
        await control(page, 'cancel').click();
      }
      await control(page, 'back').click();
    }
    expect(problems).toEqual([]);
  });
}

for (const size of SIZES) {
  test(`garden at ${size.width}x${size.height}: every board item of every level is 16 px inside the screen`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(size);
    const ids = levelIds('garden');
    const levels = Object.fromEntries(ids.map((id) => [id, { stars: 3, best: 1 }]));
    await page.addInitScript((value) => {
      if (!window.localStorage.getItem('kit.garden.v1')) window.localStorage.setItem('kit.garden.v1', value);
    }, JSON.stringify({ version: 1, levels, settings: { sound: true, music: true, usage: true }, lessons: { 'tap-lantern': 3, 'wait-turn': 3, 'switch-lantern': 3 } }));
    await page.goto('/garden/');
    await control(page, 'levels').click();
    const problems: string[] = [];
    for (const id of ids) {
      await control(page, `level-${id}`).click();
      const canvas = page.locator('[data-screen="play"] canvas');
      await expect(canvas).toHaveAttribute('data-scene', /"id":/);
      const items = await canvas.evaluate((el) => {
        const c = el.getBoundingClientRect();
        return (JSON.parse(el.getAttribute('data-scene') ?? '[]') as (Box & { id: string })[]).map((b) => ({ id: b.id, x: c.left + b.x, y: c.top + b.y, w: b.w, h: b.h }));
      });
      for (const item of items) {
        if (item.id === 'glow') continue;
        if (item.x < 16) problems.push(`${id}: ${item.id} starts at x ${item.x}`);
        if (item.y < 16) problems.push(`${id}: ${item.id} starts at y ${item.y}`);
        if (item.x + item.w > size.width - 16) problems.push(`${id}: ${item.id} ends at x ${item.x + item.w}, limit ${size.width - 16}`);
        if (item.y + item.h > size.height - 16) problems.push(`${id}: ${item.id} ends at y ${item.y + item.h}, limit ${size.height - 16}`);
      }
      await control(page, 'pause').click();
      await control(page, 'levels').click();
      await control(page, 'confirm').click();
      await expect(screen(page, 'levels')).toBeVisible();
    }
    expect(problems).toEqual([]);
  });
}
