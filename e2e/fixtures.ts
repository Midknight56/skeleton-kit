import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expandActions } from '@kit/core';
import { expect, test as base, type Locator, type Page } from '@playwright/test';

export { expect };

// Every test fails on a page error or a console error.
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
      });
      await use(problems);
      expect(problems, 'the page raised errors').toEqual([]);
    },
    { auto: true },
  ],
});

export interface ProofReplay { level: string; actions: string[]; finalHash: string; par: number }

// Reads a proof file of the repository and expands its run length items.
export function readProof(game: string, level: string): ProofReplay {
  const path = fileURLToPath(new URL(`../proofs/${game}/${level}.json`, import.meta.url));
  const proof = JSON.parse(readFileSync(path, 'utf8')) as { replay: { actions: string[]; finalHash: string }; stats: { actions: number } };
  const expanded = expandActions(proof.replay.actions);
  if (!expanded.ok) throw new Error(`${path}: ${expanded.message}`);
  return { level, actions: expanded.actions, finalHash: proof.replay.finalHash, par: proof.stats.actions };
}

export function levelIds(game: string): string[] {
  const path = fileURLToPath(new URL(`../proofs/${game}/index.json`, import.meta.url));
  return (JSON.parse(readFileSync(path, 'utf8')) as { levels: { id: string }[] }).levels.map((l) => l.id);
}

// The play root has data-tick, data-phase and data-hash. This keeps the last values seen, because the
// results screen replaces the play root a moment after the last action.
export async function recordPlay(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __play?: { tick: string; phase: string; hash: string } };
    const read = () => {
      const root = document.querySelector<HTMLElement>('[data-screen="play"]');
      if (root?.dataset.hash) w.__play = { tick: root.dataset.tick ?? '', phase: root.dataset.phase ?? '', hash: root.dataset.hash };
    };
    new MutationObserver(read).observe(document, { subtree: true, childList: true, attributes: true });
  });
}

export async function lastPlay(page: Page): Promise<{ tick: string; phase: string; hash: string } | undefined> {
  return page.evaluate(() => (window as unknown as { __play?: { tick: string; phase: string; hash: string } }).__play);
}

export function control(page: Page, id: string): Locator {
  return page.locator(`[data-control="${id}"]`);
}

export function screen(page: Page, name: string): Locator {
  return page.locator(`[data-screen="${name}"]`);
}

interface SceneBox { id: string; x: number; y: number; w: number; h: number }

// Clicks the centre of a scene item, using the boxes the canvas publishes in data-scene.
export async function clickItem(page: Page, id: string): Promise<void> {
  const canvas = page.locator('[data-screen="play"] canvas');
  // The canvas publishes its boxes after the first paint.
  await expect(canvas).toHaveAttribute('data-scene', new RegExp(`"id":"${id}"`));
  const raw = await canvas.getAttribute('data-scene');
  const box = (JSON.parse(raw ?? '[]') as SceneBox[]).find((b) => b.id === id);
  if (!box) throw new Error(`the scene has no item ${id}`);
  const area = await canvas.boundingBox();
  if (!area) throw new Error('the canvas has no box');
  await page.mouse.click(area.x + box.x + box.w / 2, area.y + box.y + box.h / 2);
}

// Sends one action of the garden puzzle as a real event and waits until the tick has moved.
export async function sendGardenAction(page: Page, action: string, tick: number): Promise<void> {
  if (action === 'wait') await control(page, 'wait').click();
  else await clickItem(page, `lantern-${action.slice('light:'.length)}`);
  const root = screen(page, 'play');
  // The last action opens the results screen soon after, so wait for either.
  await expect(root.or(screen(page, 'results'))).toBeVisible();
  await page.waitForFunction(
    (n) => {
      const play = document.querySelector<HTMLElement>('[data-screen="play"]');
      return !play || Number(play.dataset.tick) >= n;
    },
    tick + 1,
  );
}

export async function playGardenReplay(page: Page, replay: ProofReplay): Promise<void> {
  for (let i = 0; i < replay.actions.length; i++) await sendGardenAction(page, replay.actions[i] as string, i);
}

// The runner is a tick game. Its tests use a fake clock that is paused, and move it by hand, 16 ms for
// each frame. Call `installClock` before `page.goto`, and `freezeClock` after the page has loaded.
export const FRAME_MS = 16;

export async function installClock(page: Page): Promise<void> {
  await page.clock.install({ time: 0 });
}

export async function freezeClock(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}

async function tickOf(page: Page): Promise<number> {
  return Number(await screen(page, 'play').getAttribute('data-tick'));
}

// Runs frames of 16 ms until the play root shows `tick`. A frame applies at most one tick at 60 ticks
// a second (960 is added to the time owed and a tick needs 1000), so n frames cannot pass the target
// when n is the number of ticks still missing.
export async function runToTick(page: Page, tick: number): Promise<void> {
  for (let guard = 0; guard < 500; guard++) {
    const now = await tickOf(page);
    if (now === tick) return;
    if (now > tick) throw new Error(`the play is at tick ${now}, past tick ${tick}`);
    await page.clock.runFor((tick - now) * FRAME_MS);
  }
  throw new Error(`tick ${tick} was not reached`);
}

// Sends the proof replay of the runner as real events: the space key at each `jump`.
export async function playRunnerReplay(page: Page, replay: ProofReplay): Promise<void> {
  for (let i = 0; i < replay.actions.length; i++) {
    if (replay.actions[i] !== 'jump') continue;
    await runToTick(page, i);
    await page.keyboard.press(' ');
    await runToTick(page, i + 1);
  }
  // Let the last ticks run, and the short delay before the results screen.
  const total = replay.actions.length;
  for (let guard = 0; guard < 500; guard++) {
    const play = screen(page, 'play');
    if ((await play.count()) === 0) break;
    const now = await tickOf(page);
    if ((await play.getAttribute('data-phase')) !== 'playing') break;
    await page.clock.runFor(Math.max(1, total - now) * FRAME_MS);
  }
  await page.clock.runFor(500);
}

// Runs the clock on until the results screen opens, for a player who does nothing.
export async function runUntilResults(page: Page): Promise<void> {
  for (let guard = 0; guard < 60; guard++) {
    if ((await screen(page, 'results').count()) > 0) return;
    await page.clock.runFor(1000);
  }
  throw new Error('the results screen did not open');
}