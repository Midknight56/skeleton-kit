import type { Page } from '@playwright/test';
import { control, expect, screen, test } from './fixtures';

// The fix pass on the look: puppets stay out of the menu, the title glow is soft, the garden play scene
// has no moon and no glow disc, the landing page buttons fit on one line, and the landing moon and witch
// are not covered.
const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 768, height: 1024 },
  { width: 1920, height: 1080 },
];

interface Box { name: string; x: number; y: number; w: number; h: number }

// Boxes of the puppets, their strings and their glows that are drawn, and of what they must stay clear
// of: every heading, text line and control of the visible screen, and the menu column.
async function measure(page: Page): Promise<{ art: Box[]; menu: Box[] }> {
  return page.evaluate(() => {
    const box = (el: Element, name: string, pad = 0): Box => {
      const r = el.getBoundingClientRect();
      return { name, x: r.left - pad, y: r.top - pad, w: r.width + 2 * pad, h: r.height + 2 * pad };
    };
    const drawn = (el: Element): boolean => el.getClientRects().length > 0;
    const art = Array.from(document.querySelectorAll('[data-backdrop] [data-puppet], [data-backdrop] [data-string], [data-backdrop] [data-glow]'))
      .filter(drawn)
      .map((el, i) => {
        // A string is a thin line: its box is widened by its stroke.
        const stroke = el instanceof SVGGraphicsElement ? Number.parseFloat(getComputedStyle(el).strokeWidth) || 0 : 0;
        const kind = el.hasAttribute('data-string') ? 'string' : el.hasAttribute('data-glow') ? 'glow' : 'puppet';
        return box(el, `${kind} ${i}`, stroke / 2);
      });
    const menu = Array.from(document.querySelectorAll('[data-card] h1, [data-card] h2, [data-card] p, [data-card] [data-column], [data-card] button, [data-card] a'))
      .filter(drawn)
      .map((el, i) => box(el, `${el.tagName.toLowerCase()} ${i} ${(el.textContent ?? '').trim().slice(0, 16)}`));
    return { art, menu };
  });
}

function meets(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function overlaps(art: Box[], menu: Box[]): string[] {
  const found: string[] = [];
  for (const a of art) for (const m of menu) if (meets(a, m)) found.push(`${a.name} meets ${m.name}`);
  return found;
}

for (const viewport of VIEWPORTS) {
  const size = `${viewport.width}x${viewport.height}`;

  for (const game of ['garden', 'runner'] as const) {
    test(`${game} menu screens at ${size}: no puppet, string or glow sits under the menu`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/${game}/`);
      await expect(screen(page, 'title')).toBeVisible();
      // Let the title settle: the fonts and the placing of the puppets.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);

      const title = await measure(page);
      expect(overlaps(title.art, title.menu), 'title screen').toEqual([]);
      // The art is not just hidden: where the screen is wide enough some puppet is drawn.
      if (viewport.width >= 768) expect(title.art.length, 'some puppets are drawn').toBeGreaterThan(0);

      for (const id of ['levels', 'how', 'settings', 'credits']) {
        await control(page, id).click();
        await expect(screen(page, id)).toBeVisible();
        const m = await measure(page);
        expect(overlaps(m.art, m.menu), `${id} screen`).toEqual([]);
        await control(page, 'back').click();
        await expect(screen(page, 'title')).toBeVisible();
      }
    });
  }

  test(`garden title at ${size}: the lantern glow is round and soft`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/garden/');
    await expect(screen(page, 'title')).toBeVisible();
    const glows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-backdrop] [data-glow]')).map((el) => {
        const style = getComputedStyle(el);
        const radius = Number.parseFloat(style.rx || '0');
        const fill = style.fill;
        const ref = /url\("?#([^")]+)"?\)/.exec(fill)?.[1];
        const gradient: Element | null | undefined = ref ? (el as SVGElement).ownerSVGElement?.querySelector(`#${ref}`) : null;
        const stops: Element[] = gradient ? Array.from(gradient.querySelectorAll('stop')) : [];
        const last: Element | undefined = stops[stops.length - 1];
        return {
          tag: el.tagName.toLowerCase(),
          radial: gradient?.tagName.toLowerCase() === 'radialgradient',
          lastOpacity: last ? Number.parseFloat(last.getAttribute('stop-opacity') ?? '1') : 1,
          radius,
        };
      });
    });
    expect(glows.length, 'the title has a glow element').toBeGreaterThan(0);
    for (const g of glows) {
      expect(g.radial, `${g.tag} is filled with a radial gradient`).toBe(true);
      expect(g.lastOpacity, 'the gradient ends transparent').toBe(0);
    }
    // No hard shape of the lantern colour: every shape with a glow name is a circle.
    expect(glows.every((g) => g.tag === 'circle')).toBe(true);
  });

  test(`garden play and watch at ${size}: no moon and no glow disc in the scene`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/garden/');
    await control(page, 'play').click();
    const canvas = page.locator('[data-screen="play"] canvas');
    await expect(canvas).toHaveAttribute('data-scene', /"id":"/);
    const ids = (JSON.parse((await canvas.getAttribute('data-scene')) ?? '[]') as { id: string }[]).map((i) => i.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => /moon|glow/i.test(id))).toEqual([]);
    // The page moon of the shell is not drawn behind the garden play screen either.
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-backdrop] [data-moon]') as Element).display)).toBe('none');

    await page.goto('/garden/');
    await control(page, 'watch').click();
    const watch = page.locator('[data-screen="watch"] canvas');
    await expect(watch).toHaveAttribute('data-scene', /"id":"/);
    const watchIds = (JSON.parse((await watch.getAttribute('data-scene')) ?? '[]') as { id: string }[]).map((i) => i.id);
    expect(watchIds.filter((id) => /moon|glow/i.test(id))).toEqual([]);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-backdrop] [data-moon]') as Element).display)).toBe('none');
  });

  test(`landing page at ${size}: labels fit on one line, the moon and witch are not covered`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('[data-calls] li')).toHaveCount(3);
    await page.evaluate(() => document.fonts.ready);

    // The text of every button and link: its box is lower than 1.6 lines. The label is measured with a
    // range, because a sign keeps its minimum height for the thumb.
    const labels = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main a, main button'))
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
          return { text: (el.textContent ?? '').trim(), ratio: range.getBoundingClientRect().height / lineHeight };
        }),
    );
    expect(labels.length).toBeGreaterThanOrEqual(7);
    for (const l of labels) expect(l.ratio, `"${l.text}" is on one line`).toBeLessThan(1.6);

    const boxes = await page.evaluate(() => {
      const rect = (el: Element, name: string): Box => {
        const r = el.getBoundingClientRect();
        return { name, x: r.left, y: r.top, w: r.width, h: r.height };
      };
      const drawn = (el: Element): boolean => el.getClientRects().length > 0;
      const art = Array.from(document.querySelectorAll('.moon, .moon svg')).filter(drawn).map((el, i) => rect(el, i === 0 ? 'moon' : 'witch'));
      const others = Array.from(document.querySelectorAll('.card, .frame, .hung, h1, .intro p, main a, .status'))
        .filter(drawn)
        .map((el, i) => rect(el, `${el.tagName.toLowerCase()}.${el.className} ${i}`));
      return { art, others };
    });
    if (viewport.width >= 1100) expect(boxes.art.length, 'the moon and the witch show on a wide screen').toBe(2);
    expect(overlaps(boxes.art, boxes.others)).toEqual([]);
  });
}
