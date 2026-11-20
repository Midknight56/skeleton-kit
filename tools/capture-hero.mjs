// Makes docs/img/hero.png: three real captures of the built site in one picture.
// It builds nothing. Build the site first so that dist/ is current.
// The captures: the landing page (the garden plays by itself in its first screen), a garden level in
// play, and the garden level select with its proof pips. The picture holds no text of its own.
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

// Read free memory before anything starts.
const free = freemem();
say(`free memory: ${(free / 1024 ** 3).toFixed(1)} GiB`);
if (free < MIN_FREE_BYTES) fail(`free memory is under 2 GiB. Close programs and run it again.`);
if (!existsSync(join(root, 'dist', 'index.html'))) fail('dist/ is missing. Build the site first. This tool builds nothing.');

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

async function newPage(browser, problems) {
  const context = await browser.newContext({ viewport: SHOT, deviceScaleFactor: 2 });
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

async function captureGarden(browser, base, levelsFile, playFile, problems) {
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
  // Rest the pointer on bare ground, so no card is in its hover swing.
  await page.mouse.move(SHOT.width / 2, SHOT.height - 4);
  await sleep(800);
  await page.screenshot({ path: levelsFile });
  await control(page, `level-${PLAY_LEVEL}`).click();
  await playLevel(page, PLAY_LEVEL, 1);
  await page.mouse.move(SHOT.width / 2, SHOT.height - 4);
  await sleep(800);
  await page.screenshot({ path: playFile });
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
<img alt="" src="${src(files.levels)}" style="left:${gap * 2 + bigW}px; top:${gap}px; width:${smallW}px; height:${smallH}px">
<img alt="" src="${src(files.play)}" style="left:${gap * 2 + bigW}px; top:${gap * 2 + smallH}px; width:${smallW}px; height:${smallH}px">
</body></html>
`;
}

async function main() {
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
    const files = { landing: join(temp, 'landing.png'), levels: join(temp, 'levels.png'), play: join(temp, 'play.png') };
    await captureLanding(browser, base, files.landing, problems);
    await captureGarden(browser, base, files.levels, files.play, problems);
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

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
