// Builds the site into dist/: the landing page and privacy page from site/, each app that has an
// index.html into dist/<id>/, and the proof files into dist/proofs/. Then it runs the version guard.
import { Buffer } from 'node:buffer';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { transform } from 'esbuild';
import { build } from 'vite';
import { checkVersions } from './check-versions.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');

const config = JSON.parse(readFileSync(join(root, 'kit.config.json'), 'utf8'));
const apps = (config.games ?? []).filter((folder) => /^apps\/[a-z0-9-]+$/.test(folder));

async function buildPage(folder, outDir, input) {
  await build({
    configFile: join(root, 'vite.config.ts'),
    root: join(root, folder),
    logLevel: 'warn',
    build: { outDir, emptyOutDir: true, ...(input ? { rollupOptions: { input } } : {}) },
  });
}

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The list of beacon events is plain data in kit/shell/src/beacon-events.ts. The privacy page and the
// beacon read the same list, so the page cannot say more or less than the code sends.
async function beaconEvents() {
  const source = readFileSync(join(root, 'kit', 'shell', 'src', 'beacon-events.ts'), 'utf8');
  const { code } = await transform(source, { loader: 'ts', format: 'esm' });
  const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  return module.BEACON_EVENTS;
}

function fill(html, marker, text) {
  const token = `<!--${marker}-->`;
  if (!html.includes(token)) throw new Error(`The privacy page has no ${token}.`);
  return html.replace(token, () => text);
}

async function privacyPage(html) {
  const events = await beaconEvents();
  const rows = events
    .map((spec) => {
      const fields = spec.fields.map((field) => `<code>${escapeHtml(field)}</code>`).join(', ');
      return `<tr data-event="${escapeHtml(spec.event)}"><td><code>${escapeHtml(spec.event)}</code></td><td>${fields}</td><td>${escapeHtml(spec.says)}</td></tr>`;
    })
    .join('\n          ');
  const keys = apps
    .filter((folder) => existsSync(join(root, folder, 'index.html')))
    .map((folder) => `<li><code>kit.${folder.slice('apps/'.length)}.v1</code></li>`)
    .join('\n        ');
  const url = process.env.VITE_BEACON_URL ?? '';
  const state = url
    ? 'This build sends the events below to the server of its owner, when a player plays.'
    : 'This build sends nothing. The beacon is off unless the site is built with the variable VITE_BEACON_URL.';
  let out = fill(html, 'BEACON_ROWS', rows);
  out = fill(out, 'STORAGE_KEYS', keys);
  return fill(out, 'BEACON_STATE', state);
}

// The address of the repository comes from the `repository` field of package.json, or from the variable
// REPOSITORY_URL. The repository has no remote address written down, so with neither the link stays empty.
function repositoryUrl() {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const field = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const url = process.env.REPOSITORY_URL || field || '';
  if (!url) process.stderr.write('warning: no repository address. Set REPOSITORY_URL or the repository field of package.json.\n');
  return url || '#';
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// The site pages come first, because the build of a page empties its own folder only.
const site = join(root, 'site');
if (existsSync(join(site, 'index.html'))) {
  const input = { index: join(site, 'index.html') };
  if (existsSync(join(site, 'privacy.html'))) input.privacy = join(site, 'privacy.html');
  await buildPage('site', dist, input);

  const landing = join(dist, 'index.html');
  writeFileSync(landing, readFileSync(landing, 'utf8').replaceAll('__REPOSITORY_URL__', escapeHtml(repositoryUrl())), 'utf8');

  const privacy = join(dist, 'privacy.html');
  if (existsSync(privacy)) {
    mkdirSync(join(dist, 'privacy'), { recursive: true });
    renameSync(privacy, join(dist, 'privacy', 'index.html'));
    const page = join(dist, 'privacy', 'index.html');
    writeFileSync(page, await privacyPage(readFileSync(page, 'utf8')), 'utf8');
  }
}

for (const folder of apps) {
  if (!existsSync(join(root, folder, 'index.html'))) continue;
  const id = folder.slice('apps/'.length);
  process.stdout.write(`building page ${folder}\n`);
  await buildPage(folder, join(dist, id), undefined);
}

if (existsSync(join(root, 'proofs'))) cpSync(join(root, 'proofs'), join(dist, 'proofs'), { recursive: true });

const problems = checkVersions(root);
if (problems.length > 0) {
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  process.exit(1);
}
process.stdout.write('built dist/\n');
