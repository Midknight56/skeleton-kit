import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkControls, type ControlBox } from '@kit/shell';
import { control, expect, levelIds, screen, test } from './fixtures';

// The open course card of the runner level select shows the smallest window of its proof. The test reads
// the window from proofs/runner/<id>.json, never from a typed number.

const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 1280, height: 800 },
];

function windowOf(level: string): number {
  const path = fileURLToPath(new URL('../proofs/runner/' + level + '.json', import.meta.url));
  const proof = JSON.parse(readFileSync(path, 'utf8')) as { checks: { name: string; detail: string }[] };
  const detail = proof.checks.find((c) => c.name === 'window_ok')?.detail ?? '';
  const match = /^smallest window (\d+) ticks/.exec(detail);
  if (!match) throw new Error(path + ' has no window_ok number');
  return Number(match[1]);
}

for (const viewport of VIEWPORTS) {
  test('the open runner card of r01 shows its smallest window at ' + viewport.width + 'x' + viewport.height, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(viewport);
    // Every course is open, so every card shows its window.
    const progress = Object.fromEntries(levelIds('runner').map((id) => [id, { stars: 1, best: 1 }]));
    await page.addInitScript(
      ([key, data]) => window.localStorage.setItem(key as string, JSON.stringify(data)),
      ['kit.runner.v1', { version: 1, levels: progress, settings: { sound: false, music: false, usage: true }, lessons: {} }],
    );
    await page.goto('/runner/');
    await expect(screen(page, 'title')).toBeVisible();
    await control(page, 'levels').click();
    await expect(screen(page, 'levels')).toBeVisible();
    await page.mouse.move(0, 0);

    const ticks = windowOf('r01');
    const ms = Math.round((ticks * 1000) / 60);
    const card = control(page, 'level-r01');
    await expect(card).toHaveAttribute('data-locked', 'false');
    await expect(card.locator('[data-window]')).toContainText(ticks + ' steps');
    await expect(card.locator('[data-window]')).toContainText(ms + ' ms');
    expect(await card.getAttribute('aria-label')).toContain('tightest jump ' + ticks + ' steps, about ' + ms + ' ms');

    // Every course card holds the window of its own proof.
    for (const id of levelIds('runner')) {
      const t = windowOf(id);
      await expect(control(page, 'level-' + id).locator('[data-window]'), id).toContainText(t + ' steps');
      await expect(control(page, 'level-' + id), id).toHaveAttribute('data-window-ticks', String(t));
    }

    // Layout: text 12 px or more, nothing past its card, cards 12 px apart.
    const boxes = await page.evaluate(() => {
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      };
      return Array.from(document.querySelectorAll<HTMLElement>('[data-screen="levels"] [data-control^="level-"]')).map((tile) => {
        const label = tile.querySelector<HTMLElement>('[data-window]')!;
        return {
          id: (tile.dataset.control ?? '').slice('level-'.length),
          tile: box(tile),
          label: box(label),
          size: Number.parseFloat(getComputedStyle(label).fontSize),
          wide: label.scrollWidth > label.clientWidth,
          back: box(document.querySelector('[data-control="back"]')!),
        };
      });
    });
    const controls: ControlBox[] = [
      ...boxes.map((b) => ({ screen: 'levels', id: 'level-' + b.id, ...b.tile })),
      { screen: 'levels', id: 'back', ...boxes[0]!.back },
    ];
    expect(checkControls(controls, { ...viewport, safe: { top: 0, right: 0, bottom: 0, left: 0 } })).toEqual([]);
    for (const b of boxes) {
      expect(b.size, b.id + ' text size').toBeGreaterThanOrEqual(12);
      expect(b.wide, b.id + ' text is wider than its box').toBe(false);
      expect(b.label.x - b.tile.x, b.id + ' left').toBeGreaterThanOrEqual(8 - 0.5);
      expect(b.tile.x + b.tile.w - (b.label.x + b.label.w), b.id + ' right').toBeGreaterThanOrEqual(8 - 0.5);
      expect(b.tile.y + b.tile.h - (b.label.y + b.label.h), b.id + ' bottom').toBeGreaterThanOrEqual(8 - 0.5);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!.tile;
        const c = boxes[j]!.tile;
        const gap = Math.max(a.x - (c.x + c.w), c.x - (a.x + a.w), a.y - (c.y + c.h), c.y - (a.y + a.h));
        expect(gap, boxes[i]!.id + ' and ' + boxes[j]!.id + ' gap').toBeGreaterThanOrEqual(11.5);
      }
    }
  });
}