// Reads proofs/<game>/index.json and puts the numbers of each level into the page of the game, so the
// browser reads them from the page it already has. The numbers are copied as they are.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';

function fail(game, problem) {
  return new Error(`proofs/${game}/index.json ${problem}. Run npm run prove.`);
}

const whole = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0;

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
