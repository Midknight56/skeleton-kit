// Level search helper. It is not part of the game. It builds random boards from a seed, solves each one,
// and prints the boards that pass the checks of the requested level.
//
//   node apps/garden/dist/find-levels.js --level g01 --seeds 1-2000 [--limit 5]
import { pathToFileURL } from 'node:url';
import { randomInt, type GameDef, type Json } from '@kit/core';
import { solveTick, solveTurn } from '@kit/solver';
import { makeGardenDef } from '../src/def';
import { levelPlans, runChecks, turnOptions } from '../src/proof';
import { parseLevel } from '../src/rules/level';

export interface Found {
  seed: number;
  rows: string[];
  maxTurns: number;
  solution: string[];
}

const SEARCH_TURNS = 99;
const MAX_NODES = 60000;

/** A random board for the plan of a level. The same level id and seed always give the same rows. */
export function makeBoard(levelId: string, seed: number): string[] {
  const plan = levelPlans[levelId];
  if (plan === undefined) throw new Error(`There is no check plan for the level "${levelId}".`);
  let rng = seed >>> 0;
  const draw = (n: number): number => {
    const out = randomInt(rng, n);
    rng = out.state;
    return out.value;
  };

  const w = 5 + draw(5); // 5 to 9
  const h = 3 + draw(5); // 3 to 7
  const grid: string[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  const place = (ch: string): void => {
    for (let tries = 0; tries < 200; tries++) {
      const x = draw(w);
      const y = draw(h);
      if (grid[y]![x] === '.') {
        grid[y]![x] = ch;
        return;
      }
    }
  };

  const lanterns = plan.needsSwitch ? 2 + draw(3) : 1 + draw(2); // 2 to 4, or 1 to 2
  for (let id = 1; id <= lanterns; id++) place(String(id));
  for (let i = 0; i < plan.moths; i++) place('m');
  const flowers = plan.moths + draw(2);
  for (let i = 0; i < flowers; i++) place('f');
  const hedges = draw(Math.floor((w * h) / 4) + 1);
  for (let i = 0; i < hedges; i++) place('#');
  const webs = plan.webMatters ? 1 + draw(3) : draw(2);
  for (let i = 0; i < webs; i++) place('w');
  return grid.map((row) => row.join(''));
}

/** Tries each seed from `from` to `to`. Returns the boards that are solved and pass every check of the level. */
export function findLevels(levelId: string, from: number, to: number): Found[] {
  const plan = levelPlans[levelId];
  if (plan === undefined) throw new Error(`There is no check plan for the level "${levelId}".`);
  const tools = { solveTurn, solveTick };
  const found: Found[] = [];
  for (let seed = from; seed <= to; seed++) {
    const rows = makeBoard(levelId, seed);
    const draft = { id: levelId, title: 'Search', maxTurns: SEARCH_TURNS, rows };
    if (!parseLevel(draft).ok) continue;
    const search = makeGardenDef([draft]) as unknown as GameDef<Json, unknown>;
    const result = solveTurn(search, levelId, 1, { ...turnOptions, maxNodes: MAX_NODES });
    if (!result.solved) continue;

    const maxTurns = result.actions.length + 4;
    const final = makeGardenDef([{ ...draft, maxTurns }]) as unknown as GameDef<Json, unknown>;
    const checks = runChecks(final, levelId, result, tools, plan);
    if (checks.every((check) => check.passed)) found.push({ seed, rows, maxTurns, solution: result.actions });
  }
  return found;
}

export function formatFound(item: Found): string {
  return [`seed ${item.seed}, length ${item.solution.length}, maxTurns ${item.maxTurns}`, ...item.rows.map((row) => `  ${row}`), `  ${item.solution.join(' ')}`].join('\n');
}

export function parseArgs(argv: string[]): { level: string; from: number; to: number; limit: number | null } {
  const value = (name: string): string | undefined => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const level = value('--level');
  const seeds = value('--seeds');
  if (level === undefined || seeds === undefined) throw new Error('Usage: find-levels --level g01 --seeds 1-2000 [--limit 5]');
  const range = /^(\d+)-(\d+)$/.exec(seeds);
  if (range === null) throw new Error(`--seeds must look like 1-2000, got "${seeds}".`);
  const from = Number(range[1]);
  const to = Number(range[2]);
  if (from > to) throw new Error(`--seeds ${seeds} runs backwards.`);
  const limitText = value('--limit');
  if (limitText !== undefined && !/^\d+$/.test(limitText)) throw new Error(`--limit must be a whole number, got "${limitText}".`);
  return { level, from, to, limit: limitText === undefined ? null : Number(limitText) };
}

function main(): void {
  const { level, from, to, limit } = parseArgs(process.argv.slice(2));
  const found = findLevels(level, from, to);
  for (const item of limit === null ? found : found.slice(0, limit)) process.stdout.write(`${formatFound(item)}\n`);
  process.stdout.write(`found ${found.length} boards for ${level} in seeds ${from}-${to}\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`find-levels: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
