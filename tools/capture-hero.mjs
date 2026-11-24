// Makes docs/img/hero.png: three real captures of the built site in one picture.
// It builds nothing. Build the site first so that dist/ is current.
// The captures are listed in CAPTURE_PLAN: the landing page (the garden plays by itself in its first
// screen), a runner level with the broom in the air, and a garden level after a lantern move. The picture
// holds no text of its own. Importing this file starts nothing: the capture runs only from the command line.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { freemem, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'docs', 'img', 'hero.png');
const REFUSED_PORTS = new Set([4173, 4177]);
const MIN_FREE_BYTES = 2 * 1024 ** 3;
const SHOT = { width: 1280, height: 720 };
// The frames of the picture: the large one on the left, then the two on the right.
export const CAPTURE_PLAN = [
  { id: 'landing', game: 'garden', moment: 'demo plays itself' },
  { id: 'runner', game: 'runner', moment: 'mid jump' },
  { id: 'garden', game: 'garden', moment: 'lantern move' },
];

const FRAME_MS = 16;
const RUNNER_SHOT = { width: 480, height: 270 };
const WON_LEVELS = ['g01', 'g02', 'g03', 'g04'];
const PLAY_LEVEL = 'g05';

// Composite sizes in CSS pixels: 24 px gaps, one large picture on the left, two stacked on the right.
const LAYOUT = { width: 2323, height: 900, gap: 24, bigW: 1515, bigH: 852, smallW: 736, smallH: 414 };

function say(text) {
  process.stdout.write(`${text}\n`);
}

function fail(text) {
  process.stderr.write(`capture-hero: ${text}\n`);
  process.exit(1);
}


function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

async function pickPort() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const port = await freePort();
    if (!REFUSED_PORTS.has(port)) return port;
  }
  throw new Error('no free port found');
}

function startServer(port) {
  const child = spawn(process.execPath, [join(root, 'tools', 'serve-dist.mjs'), String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  const ready = new Promise((resolveReady, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`serve-dist.mjs exited with code ${code}`)));
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('serving dist/')) resolveReady(undefined);
    });
  });
  return { child, ready };
}

// The actions of a proof file, with the run length form `text*n` expanded.
function proofActions(level) {
  const proof = JSON.parse(readFileSync(join(root, 'proofs', 'garden', `${level}.json`), 'utf8'));
  return proof.replay.actions.flatMap((item) => {
    const star = item.indexOf('*');
    return star < 0 ? [item] : Array.from({ length: Number(item.slice(star + 1)) }, () => item.slice(0, star));
  });
}

const control = (page, id) => page.locator(`[data-control="${id}"]`);
const screen = (page, name) => page.locator(`[data-screen="${name}"]`);

// A real click on the centre of a scene item. The canvas publishes the boxes in data-scene.
async function clickItem(page, id) {
  const canvas = page.locator('[data-screen="play"] canvas');
  await page.waitForFunction(
    `(() => { const c = document.querySelector('[data-screen="play"] canvas'); return !!c && (c.getAttribute('data-scene') || '').includes('"id":"${id}"'); })()`,
  );
  const boxes = JSON.parse((await canvas.getAttribute('data-scene')) ?? '[]');
  const box = boxes.find((item) => item.id === id);
  const area = await canvas.boundingBox();
  if (!box || !area) throw new Error(`the scene has no item ${id}`);
  await page.mouse.click(area.x + box.x + box.w / 2, area.y + box.y + box.h / 2);
}

async function sendAction(page, action, tickAfter) {
  if (action === 'wait') await control(page, 'wait').click();
  else await clickItem(page, `lantern-${action.slice('light:'.length)}`);
  // The last action opens the results screen soon after, so wait for either.
  await page.waitForFunction(
    `(() => { const p = document.querySelector('[data-screen="play"]'); return !p || Number(p.dataset.tick) >= ${tickAfter}; })()`,
  );
}

async function playLevel(page, level, count) {
  const actions = proofActions(level);
  const n = count ?? actions.length;
  await screen(page, 'play').waitFor();
  for (let i = 0; i < n; i++) await sendAction(page, actions[i], i + 1);
}

async function newPage(browser, problems, viewport = SHOT, scale = 2) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale });
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
  });
  return page;
}

async function captureLanding(browser, base, file, problems) {
  const page = await newPage(browser, problems);
  await page.goto(`${base}/`);
  const watch = page.frameLocator('iframe[data-frame="watch"]').locator('[data-screen="watch"]');
  await watch.waitFor();
  // The garden plays by itself. Take the picture a few ticks into the run.
  for (let guard = 0; guard < 200; guard++) {
    const tick = Number((await watch.getAttribute('data-tick')) ?? '0');
    const phase = await watch.getAttribute('data-phase');
    if (tick >= 2 && phase === 'playing') break;
    await sleep(100);
  }
  await page.screenshot({ path: file });
  await page.context().close();
}

// The garden: win the levels before the play level, so that it is open, then make one lantern move there.
async function captureGarden(browser, base, playFile, problems) {
  const page = await newPage(browser, problems);
  await page.goto(`${base}/garden/`);
  await screen(page, 'title').waitFor();
  await control(page, 'play').click();
  for (const [index, level] of WON_LEVELS.entries()) {
    await playLevel(page, level);
    await screen(page, 'results').waitFor();
    if (index < WON_LEVELS.length - 1) await control(page, 'next').click();
  }
  await control(page, 'levels').click();
  await screen(page, 'levels').waitFor();
  await control(page, `level-${PLAY_LEVEL}`).click();
  await playLevel(page, PLAY_LEVEL, 1);
  // Rest the pointer on bare ground, so no control is in its hover swing.
  await page.mouse.move(SHOT.width / 2, SHOT.height - 4);
  await sleep(800);
  await page.screenshot({ path: playFile });
  await page.context().close();
}

// The player item of the runner scene: its top and bottom edge, or null while the scene is not drawn.
async function playerBox(page) {
  const raw = await page.locator('[data-screen="play"] canvas').getAttribute('data-scene');
  const item = JSON.parse(raw ?? '[]').find((entry) => entry.id === 'player');
  return item ? { top: item.y, bottom: item.y + item.h } : null;
}

// The runner: a real game on the first course. The clock is installed first, so the run is exact. The
// space key is pressed at the first jump of its proof file, and the picture is taken when the broom is high.
async function captureRunner(browser, base, file, problems) {
  const proof = JSON.parse(readFileSync(join(root, 'proofs', 'runner', 'r01.json'), 'utf8'));
  const actions = proof.replay.actions.flatMap((item) => {
    const star = item.indexOf('*');
    return star < 0 ? [item] : Array.from({ length: Number(item.slice(star + 1)) }, () => item.slice(0, star));
  });
  const firstJump = actions.indexOf('jump');
  if (firstJump < 1) throw new Error('the proof of r01 holds no jump');
  // A small window with a high pixel ratio makes the witch big in the picture. The picture keeps the 16 to 9 shape.
  const page = await newPage(browser, problems, RUNNER_SHOT, 4);
  await page.clock.install({ time: 0 });
  await page.goto(`${base}/runner/`);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  await screen(page, 'title').waitFor();
  await control(page, 'play').click();
  await screen(page, 'play').waitFor();
  const tick = async () => Number(await screen(page, 'play').getAttribute('data-tick'));
  while ((await tick()) < firstJump) await page.clock.runFor(Math.max(1, firstJump - (await tick())) * FRAME_MS);
  const ground = await playerBox(page);
  if (!ground) throw new Error('the runner scene has no player');
  await page.keyboard.press(' ');
  // Step one tick at a time until the broom is clearly off the ground.
  let lifted = false;
  for (let step = 0; step < 60 && !lifted; step++) {
    await page.clock.runFor(FRAME_MS);
    const box = await playerBox(page);
    lifted = box !== null && ground.bottom - box.bottom >= 40;
  }
  if (!lifted) throw new Error('the broom did not rise at least 40 px');
  await page.mouse.move(RUNNER_SHOT.width / 2, RUNNER_SHOT.height - 2);
  await page.screenshot({ path: file });
  await page.context().close();
}
function compositePage(files) {
  const { width, height, gap, bigW, bigH, smallW, smallH } = LAYOUT;
  const src = (file) => pathToFileURL(file).href;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>hero</title>
<style>
html, body { margin: 0; width: ${width}px; height: ${height}px; background: #14101c; overflow: hidden; }
img { position: absolute; display: block; border-radius: 14px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55); }
</style></head><body>
<img alt="" src="${src(files.landing)}" style="left:${gap}px; top:${gap}px; width:${bigW}px; height:${bigH}px">
<img alt="" src="${src(files.runner)}" style="left:${gap * 2 + bigW}px; top:${gap}px; width:${smallW}px; height:${smallH}px">
<img alt="" src="${src(files.play)}" style="left:${gap * 2 + bigW}px; top:${gap * 2 + smallH}px; width:${smallW}px; height:${smallH}px">
</body></html>
`;
}

async function main() {
  // Read free memory before anything starts.
  const free = freemem();
  say(`free memory: ${(free / 1024 ** 3).toFixed(1)} GiB`);
  if (free < MIN_FREE_BYTES) fail('free memory is under 2 GiB. Close programs and run it again.');
  if (!existsSync(join(root, 'dist', 'index.html'))) fail('dist/ is missing. Build the site first. This tool builds nothing.');
  const port = await pickPort();
  const server = startServer(port);
  const temp = mkdtempSync(join(tmpdir(), 'skeleton-kit-hero-'));
  let browser;
  try {
    await server.ready;
    const base = `http://127.0.0.1:${port}`;
    say(`serving dist/ on ${base}`);
    browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
    const problems = [];
    const files = { landing: join(temp, 'landing.png'), runner: join(temp, 'runner.png'), play: join(temp, 'play.png') };
    await captureLanding(browser, base, files.landing, problems);
    await captureRunner(browser, base, files.runner, problems);
    await captureGarden(browser, base, files.play, problems);
    if (problems.length > 0) throw new Error(`the pages raised errors:\n${problems.join('\n')}`);

    const pagePath = join(temp, 'hero.html');
    writeFileSync(pagePath, compositePage(files), 'utf8');
    const context = await browser.newContext({ viewport: { width: LAYOUT.width, height: LAYOUT.height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(pathToFileURL(pagePath).href);
    await page.waitForFunction('Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0)');
    mkdirSync(join(root, 'docs', 'img'), { recursive: true });
    await page.screenshot({ path: out });
    await context.close();
    say(`wrote docs/img/hero.png (${LAYOUT.width}x${LAYOUT.height})`);
  } finally {
    if (browser) await browser.close();
    server.child.removeAllListeners('exit');
    server.child.kill();
    rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
