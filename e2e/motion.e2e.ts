import type { Page } from '@playwright/test';
import { control, expect, readProof, screen, sendGardenAction, test } from './fixtures';

// Effects are drawing only. With reduced motion every effect is off. Without it, a win in the garden
// puzzle and a jump of the runner draw particles. The canvas publishes the live count in data-effects
// and the count of each kind in data-effect-kinds.

interface Running { name: string; target: string }

// Every CSS animation and transition that is running on the page now, apart from the loading cue.
async function running(page: Page): Promise<Running[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === 'running')
      .map((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
        const name = (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? 'unknown';
        return { name, target: target ? `${target.tagName.toLowerCase()}${target.closest('[data-screen]') ? '' : ' (outside a screen)'}` : 'none' };
      })
      .filter((a) => a.name !== 'loading-pulse'),
  );
}

const MENUS = ['title', 'levels', 'how', 'settings', 'credits'];

async function openMenu(page: Page, id: string): Promise<void> {
  if (id !== 'title') await control(page, id).click();
  await expect(screen(page, id)).toBeVisible();
}

for (const game of ['garden', 'runner']) {
  test.describe(`${game} with reduced motion`, () => {
    test.use({ reducedMotion: 'reduce' });

    test('no CSS animation or transition runs on a menu screen once the 150 ms fade is over', async ({ page }) => {
      for (const id of MENUS) {
        await page.goto(`/${game}/`);
        await openMenu(page, id);
        await control(page, id === 'title' ? 'play' : 'back').hover();
        await page.waitForTimeout(400);
        expect(await running(page), `${game} ${id}`).toEqual([]);
      }
    });

    test('the canvas effect layer draws no particles', async ({ page }) => {
      await page.goto(`/${game}/`);
      await control(page, 'play').click();
      const canvas = page.locator('[data-screen="play"] canvas');
      await expect(canvas).toHaveAttribute('data-effects', '0');
      if (game === 'garden') {
        await sendGardenAction(page, 'light:1', 0);
      } else {
        await page.keyboard.press(' ');
        await page.waitForTimeout(500);
      }
      await expect(canvas).toHaveAttribute('data-effects', '0');
      await expect(canvas).toHaveAttribute('data-effect-kinds', '{}');
    });
  });
}

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a garden win adds motes, and the results screen comes after the flourish', async ({ page }) => {
    await page.goto('/garden/');
    await control(page, 'play').click();
    const canvas = page.locator('[data-screen="play"] canvas');
    await expect(canvas).toHaveAttribute('data-effects', '0');
    const proof = readProof('garden', 'g01');
    for (let i = 0; i < proof.actions.length - 1; i++) await sendGardenAction(page, proof.actions[i] as string, i);
    const last = proof.actions.length - 1;
    await sendGardenAction(page, proof.actions[last] as string, last);
    await page.waitForFunction(() => Number(document.querySelector('[data-screen="play"] canvas')?.getAttribute('data-effects') ?? 0) > 0, undefined, { polling: 'raf' });
    const kinds = JSON.parse((await canvas.getAttribute('data-effect-kinds')) ?? '{}') as Record<string, number>;
    expect((kinds.mote ?? 0) + (kinds.flourish ?? 0)).toBeGreaterThan(0);
    await expect(screen(page, 'results')).toBeVisible();
  });

  test('a lit lantern blooms and the boxes of the scene stay where the rules put them', async ({ page }) => {
    await page.goto('/garden/');
    await control(page, 'play').click();
    const canvas = page.locator('[data-screen="play"] canvas');
    await expect(canvas).toHaveAttribute('data-scene', /lantern-1/);
    const before = await canvas.getAttribute('data-scene');
    await page.waitForTimeout(500);
    expect(await canvas.getAttribute('data-scene')).toBe(before);
  });

  test('a runner jump adds dust and sparks', async ({ page }) => {
    await page.goto('/runner/');
    await control(page, 'play').click();
    const canvas = page.locator('[data-screen="play"] canvas');
    await expect(canvas).toHaveAttribute('data-effects', /\d+/);
    const kinds = async () => JSON.parse((await canvas.getAttribute('data-effect-kinds')) ?? '{}') as Record<string, number>;
    await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('[data-screen="play"]')?.dataset.tick ?? 0) > 20, undefined, { polling: 'raf' });
    expect((await kinds()).dust ?? 0).toBe(0);
    await page.keyboard.press(' ');
    await page.waitForFunction(
      () => {
        const k = JSON.parse(document.querySelector('[data-screen="play"] canvas')?.getAttribute('data-effect-kinds') ?? '{}') as Record<string, number>;
        return (k.dust ?? 0) > 0 && (k.spark ?? 0) > 0;
      },
      undefined,
      { polling: 'raf', timeout: 5000 },
    );
    expect(Number(await canvas.getAttribute('data-effects'))).toBeLessThanOrEqual(200);
  });

  test('the garden shown in the watch frame of the landing page has the same effects', async ({ page }) => {
    await page.goto('/');
    const inner = page.frameLocator('iframe[data-frame="watch"]');
    await expect(inner.locator('canvas')).toHaveAttribute('data-effects', /\d+/);
  });
});

test.describe('motion of the menu screens', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the strings of a card sway and a button swings once on hover, and the old card leaves a hollow ghost', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __ghosts?: { text: string; controls: number }[] };
      w.__ghosts = [];
      new MutationObserver((records) => {
        for (const r of records) {
          for (const n of Array.from(r.addedNodes)) {
            if (n instanceof HTMLElement && n.hasAttribute('data-lift')) w.__ghosts?.push({ text: n.textContent ?? '', controls: n.querySelectorAll('[data-control], button, h1').length });
          }
        }
      }).observe(document, { subtree: true, childList: true });
    });
    await page.goto('/garden/');
    await control(page, 'levels').click();
    await expect(screen(page, 'levels')).toBeVisible();
    const names = async () => (await running(page)).map((a) => a.name);
    await expect.poll(names).toContain('kit-string-sway');
    await control(page, 'back').hover();
    await expect.poll(names).toContain('kit-swing');
    await control(page, 'back').click();
    await expect(screen(page, 'title')).toBeVisible();
    const ghosts = await page.evaluate(() => (window as unknown as { __ghosts: { text: string; controls: number }[] }).__ghosts);
    expect(ghosts).toEqual([{ text: '', controls: 0 }]);
    await expect(page.locator('[data-lift]')).toHaveCount(0);
  });

  test('a control can be clicked at once while a new screen is coming in', async ({ page }) => {
    await page.goto('/runner/');
    await control(page, 'how').click();
    await control(page, 'back').click();
    await control(page, 'credits').click();
    await expect(screen(page, 'credits')).toBeVisible();
  });
});
