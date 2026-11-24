// Reads proofs/<game>/index.json and puts the numbers of each level into the page of the game, so the
// browser reads them from the page it already has. The numbers are copied as they are.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';

function fail(game, problem) {
  return new Error(`proofs/${game}/index.json ${problem}. Run npm run prove.`);
}

const whole = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0;

// A tick proof holds the check window_ok, with a detail like "smallest window 10 ticks, the plan needs 9".
// The number is copied from there. A missing, failed or unreadable check stops the build.
function readWindow(repoRoot, gameId, id) {
  const file = join(repoRoot, 'proofs', gameId, `${id}.json`);
  if (!existsSync(file)) return undefined;
  let proof;
  try {
    proof = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`proofs/${gameId}/${id}.json is not valid JSON, level ${id}. Run npm run prove.`);
  }
  if (proof === null || typeof proof !== 'object' || proof.kind !== 'tick') return undefined;
  const check = Array.isArray(proof.checks) ? proof.checks.find((c) => c !== null && typeof c === 'object' && c.name === 'window_ok') : undefined;
  const problem = (text) => new Error(`proofs/${gameId}/${id}.json, level ${id}: ${text}. Run npm run prove.`);
  if (!check) throw problem('has no window_ok check');
  if (check.passed !== true) throw problem('the window_ok check did not pass');
  const match = typeof check.detail === 'string' ? /^smallest window (\d+) ticks(?:,|$)/.exec(check.detail) : null;
  const window = match ? Number(match[1]) : 0;
  if (!Number.isSafeInteger(window) || window < 1) throw problem('the window_ok detail holds no whole number window');
  return window;
}

export function readLevelFacts(repoRoot, gameId) {
  const file = join(repoRoot, 'proofs', gameId, 'index.json');
  if (!existsSync(file)) throw fail(gameId, 'is missing');
  let index;
  try {
    index = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw fail(gameId, 'is not valid JSON');
  }
  if (index === null || typeof index !== 'object' || !Array.isArray(index.levels)) {
    throw fail(gameId, 'has no list of levels');
  }
  const levels = {};
  for (const item of index.levels) {
    if (item === null || typeof item !== 'object' || typeof item.id !== 'string') throw fail(gameId, 'has an item without an id');
    if (!whole(item.actions)) throw fail(gameId, `has no whole number actions for ${item.id}`);
    const facts = { actions: item.actions };
    if (item.firstMoves !== undefined) facts.firstMoves = item.firstMoves;
    const window = readWindow(repoRoot, gameId, item.id);
    if (window !== undefined) facts.window = window;
    levels[item.id] = facts;
  }
  return { game: gameId, levels };
}

export function levelFactsPlugin(repoRoot) {
  let pageRoot = '';
  return {
    name: 'kit-level-facts',
    configResolved(config) {
      pageRoot = config.root;
    },
    transformIndexHtml(html) {
      const parts = relative(join(repoRoot, 'apps'), pageRoot).split(sep);
      if (parts.length !== 1 || parts[0] === '' || parts[0] === '..' || dirname(pageRoot) === pageRoot) return html;
      const facts = readLevelFacts(repoRoot, basename(pageRoot));
      const json = JSON.stringify(facts).replaceAll('<', '\\u003c');
      const tag = `<script type="application/json" id="kit-level-facts">${json}</script>`;
      if (!html.includes('</head>')) throw new Error(`The page of ${basename(pageRoot)} has no </head>.`);
      return html.replace('</head>', () => `${tag}</head>`);
    },
  };
}
