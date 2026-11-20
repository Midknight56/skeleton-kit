import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { FRAME_MS, clickItem, control, expect, freezeClock, installClock, levelIds, playRunnerReplay, readProof, screen, test } from './fixtures';

// Requirement 2 of .kiro/specs/accessibility-scan. axe-core runs on every screen of the game shell, for both
// games at three viewports. The test fails on any serious or critical violation and writes the whole run to
// docs/acceptance/a11y/report.json. Nothing is excluded from the scan and no rule is turned off.
// axe cannot read the canvas, so rules it cannot judge there come back as incomplete and are listed.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 768, height: 1024 },
  { width: 1920, height: 1080 },
];
const IMPACTS = ['critical', 'serious', 'moderate', 'minor'] as const;
type Impact = (typeof IMPACTS)[number];
const REPORT = fileURLToPath(new URL('../docs/acceptance/a11y/report.json', import.meta.url));

interface Entry {
  game: string;
  viewport: string;
  screen: string;
  counts: Record<Impact, number>;
  violations: string[];
  incomplete: string[];
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
      // An idle player loses, so the won results screen comes from the proof replay on a fresh start.
      await page.goto('/runner/');
      await control(page, 'play').click();
      await expect(screen(page, 'play')).toBeVisible();
      await playRunnerReplay(page, readProof('runner', levelIds('runner')[0] as string));
    },
  },
];

// Waits until the one shot animations of the open screen have ended, so axe reads settled colours.
async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

test('every screen of both games passes axe at three viewports, and the run is recorded', async ({ browser, problems }) => {
  test.setTimeout(600_000);
  const entries: Entry[] = [];
  const failures: string[] = [];
  let engine = '';

  async function scan(page: Page, game: string, viewport: string, name: string, clocked: boolean): Promise<void> {
    await settle(page);
    const analysis = new AxeBuilder({ page }).withTags(TAGS).analyze();
    // The runner test clock is paused and axe needs timers, so move the clock 1 ms at a time while axe works.
    let done = false;
    const pump = (async () => {
      while (clocked && !done) await page.clock.runFor(1).catch(() => undefined);
    })();
    const results = await analysis.finally(() => {
      done = true;
    });
    await pump;
    engine = results.testEngine.version;
    const counts: Record<Impact, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const v of results.violations) {
      const impact = (v.impact ?? 'minor') as Impact;
      counts[impact] += 1;
      if (impact === 'critical' || impact === 'serious') {
        for (const node of v.nodes) failures.push(`${v.id} (${impact}) at ${node.target.join(' ')} on screen ${name}, ${game}, ${viewport}`);
      }
    }
    entries.push({
      game,
      viewport,
      screen: name,
      counts,
      violations: results.violations.map((v) => v.id).sort(),
      incomplete: results.incomplete.map((v) => v.id).sort(),
    });
  }

  try {
    for (const game of GAMES) {
      for (const size of VIEWPORTS) {
        const viewport = `${size.width}x${size.height}`;
        const context = await browser.newContext({ viewport: size, baseURL: 'http://127.0.0.1:4173' });
        const page = await context.newPage();
        page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
        page.on('console', (message) => {
          if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
        });

        await game.open(page);
        await expect(screen(page, 'title')).toBeVisible();
        await expect(control(page, 'watch')).toBeVisible();
        await scan(page, game.name, viewport, 'title', game.name === 'runner');

        await control(page, 'levels').click();
        await expect(screen(page, 'levels')).toBeVisible();
        await scan(page, game.name, viewport, 'levels', game.name === 'runner');
        await control(page, 'back').click();

        await control(page, 'how').click();
        await expect(screen(page, 'how')).toBeVisible();
        await scan(page, game.name, viewport, 'how', game.name === 'runner');
        await control(page, 'back').click();

        await control(page, 'credits').click();
        await expect(screen(page, 'credits')).toBeVisible();
        await scan(page, game.name, viewport, 'credits', game.name === 'runner');
        await control(page, 'back').click();

        await control(page, 'settings').click();
        await expect(screen(page, 'settings')).toBeVisible();
        await scan(page, game.name, viewport, 'settings', game.name === 'runner');
        await control(page, 'reset').click();
        await expect(page.locator('[data-dialog="confirm"]')).toBeVisible();
        await scan(page, game.name, viewport, 'reset-confirm', game.name === 'runner');
        await control(page, 'cancel').click();
        await control(page, 'back').click();

        await control(page, 'play').click();
        await expect(screen(page, 'play')).toBeVisible();
        await game.afterPlayStart(page);
        await expect(page.locator('[data-hint]').first()).toBeVisible();
        await scan(page, game.name, viewport, 'play', game.name === 'runner');
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await expect(screen(page, 'pause')).toBeVisible();
        await scan(page, game.name, viewport, 'pause', game.name === 'runner');
        await control(page, 'resume').click();
        await game.afterPlayStart(page);

        await game.toResults(page);
        await expect(screen(page, 'results')).toBeVisible();
        await expect(screen(page, 'results')).toHaveAttribute('data-phase', 'won');
        await scan(page, game.name, viewport, 'results', game.name === 'runner');
        await context.close();
      }
    }
  } finally {
    const totals: Record<Impact, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const e of entries) for (const i of IMPACTS) totals[i] += e.counts[i];
    const report = {
      tool: 'axe-core through @axe-core/playwright',
      axeCoreVersion: engine,
      tags: TAGS,
      scans: entries.length,
      totals,
      entries,
    };
    mkdirSync(fileURLToPath(new URL('../docs/acceptance/a11y/', import.meta.url)), { recursive: true });
    writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  expect(entries.length, 'scans done: 2 games, 3 viewports, 9 screens').toBe(54);
  expect(failures, 'serious or critical axe violations').toEqual([]);
});
