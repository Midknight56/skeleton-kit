// The prove command. It reads kit.config.json from the current folder, proves every level of every listed game,
// and writes proofs/<game>/<level>.json and proofs/<game>/index.json. All file access in the solver sits here.
//
// Exit codes: 0 all proven, 1 a level or a check failed, 2 a difference in --check mode,
// 3 a missing or bad kit.config.json or game build.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSession, runReplay, validateDef, type GameDef, type Json } from '@kit/core';
import { solveTick } from './tick';
import { countFirstMoves, solveTurn, type FirstMoves, type SolveResult, type TurnOptions } from './turn';

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

interface ProofTools {
  solveTurn: typeof solveTurn;
  solveTick: typeof solveTick;
}

interface Game {
  dir: string;
  def: GameDef<Json, unknown>;
  turnOptions: TurnOptions | undefined;
  levelChecks: ((def: GameDef<Json, unknown>, levelId: string, result: SolveResult, tools: ProofTools) => CheckResult[]) | undefined;
}

interface ProofFile {
  game: string;
  name: string; // file name inside proofs/<game>/
  text: string;
}

const SEED = 1;

class Exit extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

/** JSON with sorted keys, two space indent and a final new line. */
function stable(value: unknown): string {
  const sorted = (_key: string, item: unknown): unknown => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(item).sort()) out[key] = (item as Record<string, unknown>)[key];
    return out;
  };
  return `${JSON.stringify(value, sorted, 2)}\n`;
}

function readConfig(root: string): string[] {
  const file = join(root, 'kit.config.json');
  if (!existsSync(file)) throw new Exit(3, `kit.config.json not found in ${root}`);
  let config: unknown;
  try {
    config = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Exit(3, `kit.config.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const games = (config as { games?: unknown } | null)?.games;
  if (!Array.isArray(games) || games.some((item) => typeof item !== 'string')) {
    throw new Exit(3, 'kit.config.json must hold {"games": [list of game folders]}');
  }
  return games as string[];
}

async function importFile(file: string): Promise<Record<string, unknown>> {
  return (await import(pathToFileURL(file).href)) as Record<string, unknown>;
}

async function loadGame(root: string, dir: string): Promise<Game> {
  const appDir = resolve(root, dir);
  const defFile = join(appDir, 'dist', 'def.js');
  if (!existsSync(defFile)) throw new Exit(3, `${defFile} not found. Build the game first.`);
  let def: GameDef<Json, unknown>;
  try {
    def = (await importFile(defFile)).default as GameDef<Json, unknown>;
  } catch (error) {
    throw new Exit(3, `cannot load ${defFile}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
  }
  if (def === undefined || def === null) throw new Exit(3, `${defFile} has no default export`);
  const problems = validateDef(def);
  if (problems.length > 0) throw new Exit(3, `${defFile} is not a valid game definition: ${problems.join('; ')}`);

  let turnOptions: TurnOptions | undefined;
  let levelChecks: Game['levelChecks'];
  const proofFile = join(appDir, 'dist', 'proof.js');
  if (existsSync(proofFile)) {
    try {
      const extra = await importFile(proofFile);
      turnOptions = extra.turnOptions as TurnOptions | undefined;
      levelChecks = typeof extra.levelChecks === 'function' ? (extra.levelChecks as Game['levelChecks']) : undefined;
    } catch (error) {
      throw new Exit(3, `cannot load ${proofFile}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
    }
  }
  return { dir: appDir, def, turnOptions, levelChecks };
}

/** Proves one level. Returns the proof file text and the action count, or the reason it failed. */
function proveLevel(game: Game, levelId: string): { ok: true; text: string; actions: number; firstMoves?: FirstMoves } | { ok: false; reason: string } {
  const { def } = game;
  const result = def.kind === 'turn' ? solveTurn(def, levelId, SEED, game.turnOptions) : solveTick(def, levelId, SEED);
  if (!result.solved) return { ok: false, reason: `not solved: ${result.reason} after ${result.nodes} nodes` };

  const session = createSession(def, levelId, SEED);
  for (const text of result.actions) {
    const applied = session.apply(text);
    if (!applied.ok) return { ok: false, reason: `the solution was refused at "${text}": ${applied.error}` };
  }
  const replay = session.toReplay();
  const check = runReplay(def, replay);
  if (!check.ok) return { ok: false, reason: `the replay check failed: ${check.error}: ${check.message}` };
  if (check.finalPhase !== 'won') return { ok: false, reason: `the replay ends in phase ${check.finalPhase}, not won` };

  let firstMoves: FirstMoves | undefined;
  if (def.kind === 'turn') {
    const counted = countFirstMoves(def, levelId, SEED, game.turnOptions);
    if (!counted.decided) return { ok: false, reason: `first move ${counted.action} hit ${counted.reason}` };
    firstMoves = counted.firstMoves;
  }

  let checks: CheckResult[] = [];
  if (game.levelChecks !== undefined) {
    try {
      checks = game.levelChecks(def, levelId, result, { solveTurn, solveTick });
    } catch (error) {
      return { ok: false, reason: `level checks threw: ${error instanceof Error ? error.message : String(error)}` };
    }
    for (const item of checks) {
      if (!item.passed) return { ok: false, reason: `check ${item.name} failed: ${item.detail}` };
    }
  }
  const text = stable({
    checks,
    format: 1,
    game: def.id,
    kind: def.kind,
    level: levelId,
    replay,
    rulesVersion: def.rulesVersion,
    seed: SEED,
    stats: { actions: result.actions.length, ...(firstMoves === undefined ? {} : { firstMoves }), nodes: result.nodes },
  });
  return { ok: true, text, actions: result.actions.length, ...(firstMoves === undefined ? {} : { firstMoves }) };
}

async function run(argv: string[]): Promise<number> {
  const check = argv.includes('--check');
  const root = process.cwd();
  const games: Game[] = [];
  for (const dir of readConfig(root)) games.push(await loadGame(root, dir));

  // Build every proof in memory first. Files change only when every level passed.
  const files: ProofFile[] = [];
  const failures: string[] = [];
  for (const game of games) {
    const index: { actions: number; firstMoves?: FirstMoves; id: string }[] = [];
    for (const level of game.def.levels()) {
      const outcome = proveLevel(game, level.id);
      if (!outcome.ok) {
        failures.push(`${game.def.id} ${level.id}: proofs/${game.def.id}/${level.id}.json: ${outcome.reason}`);
        continue;
      }
      files.push({ game: game.def.id, name: `${level.id}.json`, text: outcome.text });
      index.push({ actions: outcome.actions, ...(outcome.firstMoves === undefined ? {} : { firstMoves: outcome.firstMoves }), id: level.id });
      process.stdout.write(`proved ${game.def.id} ${level.id}: ${outcome.actions} actions\n`);
    }
    files.push({ game: game.def.id, name: 'index.json', text: stable({ game: game.def.id, levels: index }) });
  }
  if (failures.length > 0) {
    for (const line of failures) process.stderr.write(`${line}\n`);
    return 1;
  }

  if (check) {
    for (const file of files) {
      const path = join(root, 'proofs', file.game, file.name);
      const same = existsSync(path) && readFileSync(path, 'utf8') === file.text;
      if (!same) {
        const level = file.name.replace(/\.json$/, '');
        const what = existsSync(path) ? 'differs from the fresh proof' : 'has no file';
        process.stderr.write(`${file.game} ${level}: proofs/${file.game}/${file.name} ${what}\n`);
        return 2;
      }
    }
    return 0;
  }

  for (const file of files) {
    const folder = join(root, 'proofs', file.game);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, file.name), file.text, 'utf8');
  }
  return 0;
}

run(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    if (error instanceof Exit) {
      process.stderr.write(`prove: ${error.message}\n`);
      process.exitCode = error.code;
    } else {
      process.stderr.write(`prove: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
      process.exitCode = 3;
    }
  },
);
