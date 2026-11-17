import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hudTextBoxes } from '@kit/shell';
import type { Scene } from '@kit/core';
import { control, expect, screen, test } from './fixtures';

// A hint chip over the garden art never overlaps an item of the scene, the counter text or a control.
const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 768, height: 1024 },
  { width: 1920, height: 1080 },
];

interface Box { id: string; x: number; y: number; w: number; h: number }
interface Level { id: string; maxTurns: number }

const levels = JSON.parse(readFileSync(fileURLToPath(new URL('../apps/garden/src/levels/levels.json', import.meta.url)), 'utf8')) as Level[];

const overlap = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// The size of one px of the play screen, the same rule as `uiScale`.
const scaleOf = (w: number, h: number): number => Math.min(2, Math.max(1, 1 + Math.min((w - 360) / 1560, (h - 640) / 440)));

for (const viewport of VIEWPORTS) {
  test(`garden chips avoid every item, the counter and the controls at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    // Every level is open, so the test can start each one.
    await page.addInitScript((ids) => {
      const done = Object.fromEntries(ids.map((id) => [id, { stars: 3, best: 1 }]));
      window.localStorage.setItem('kit.garden.v1', JSON.stringify({ version: 1, levels: done, settings: { sound: false, music: false, usage: false }, lessons: {} }));
    }, levels.map((l) => l.id));

    let withChips = 0;
    for (const level of levels) {
      await page.goto('/garden/');
      await control(page, 'levels').click();
      await control(page, `level-${level.id}`).click();
      await expect(screen(page, 'play')).toBeVisible();
      const canvas = page.locator('[data-screen="play"] canvas');
      await expect(canvas).toHaveAttribute('data-scene', /"id":"/);
      const chips = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-hint]')).map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.dataset.hint as string, x: r.left, y: r.top, w: r.width, h: r.height };
        }),
      );
      if (chips.length === 0) continue;
      withChips++;

      const items = JSON.parse((await canvas.getAttribute('data-scene')) ?? '[]') as Box[];
      const scale = scaleOf(viewport.width, viewport.height);
      const hudScene: Scene = {
        width: viewport.width,
        height: viewport.height,
        items: [{ kind: 'text', id: 'hud-turn', layer: 'hud', x: viewport.width / 2, y: 36 * scale, text: `Turn 0 of ${level.maxTurns}`, size: 24 * scale, fill: '#ffffff', align: 'center' }],
      };
      const hud = hudTextBoxes(hudScene);
      const controls: Box[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-screen="play"] [data-control]')).map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.dataset.control as string, x: r.left, y: r.top, w: r.width, h: r.height };
        }),
      );
      expect(items.length, `${level.id}: scene boxes`).toBeGreaterThan(0);

      const problems: string[] = [];
      for (const chip of chips) {
        for (const item of items) if (overlap(chip, item)) problems.push(`${level.id}: chip ${chip.id} overlaps item ${item.id}`);
        for (const box of hud) if (overlap(chip, box)) problems.push(`${level.id}: chip ${chip.id} overlaps the counter text`);
        for (const c of controls) if (overlap(chip, c)) problems.push(`${level.id}: chip ${chip.id} overlaps control ${c.id}`);
      }
      expect(problems, `chips at ${viewport.width}x${viewport.height}`).toEqual([]);
    }
    expect(withChips, 'at least one level shows chips').toBeGreaterThan(0);
  });
}
