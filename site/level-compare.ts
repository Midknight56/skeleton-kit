// The level edit comparison of the landing page. It is pure: no DOM, no network, no storage.
// It takes the shipped garden level g01 and an edited copy, plays the same moves on both with real
// sessions, and says in plain words where the outcomes first differ. The moves come from the kit search
// on the original level. A saved file holds only inputs (both levels, the seed and the moves). It never
// holds a result, and an import plays the moves again.
import { createSession, type GameDef, type Json } from '@kit/core';
import { solveTurn } from '@kit/solver';
import { makeGardenDef } from '../apps/garden/src/def';
import levelsJson from '../apps/garden/src/levels/levels.json';
import { turnOptions } from '../apps/garden/src/proof';
import { parseLevel, type RawLevel } from '../apps/garden/src/rules/level';
import type { GardenState } from '../apps/garden/src/rules/state';

export const LEVEL_ID = 'g01';
export const SEED = 1;
export const EXAMPLE_ROWS = ['2.1f.', 'm..#.', '.f...'];
export const FILE_FORMAT = 'skeleton-kit/level-compare';
export const FILE_VERSION = 1;
export const LIMITS = {
  maxGridChars: 120,
  maxFileBytes: 8192,
  maxMoves: 40,
  maxSeed: 2147483647,
  searchNodes: 5000,
  maxTitle: 40,
} as const;
export const LEGEND = '. empty, # hedge, w web, f flower, m moth, 1 to 5 lantern';

export type Level = RawLevel;
export type Problems = { ok: false; problems: string[] };

/** A copy of the shipped level. Nothing in the shipped list is ever changed. */
export function shippedLevel(): Level {
  const found = (levelsJson as Level[]).find((level) => level.id === LEVEL_ID);
  if (!found) throw new Error(`The shipped level ${LEVEL_ID} is missing.`);
  return { ...found, rows: [...found.rows] };
}

function defFor(level: Level): GameDef<Json, unknown> {
  return makeGardenDef([level]) as unknown as GameDef<Json, unknown>;
}

/** The definition of a level, for painting a frame. */
export function levelDef(level: Level): GameDef<Json, unknown> {
  return defFor(level);
}

/** Checks a level with the rules of the garden puzzle. */
export function checkLevel(level: Level): { ok: true } | Problems {
  const parsed = parseLevel(level);
  return parsed.ok ? { ok: true } : { ok: false, problems: parsed.problems };
}

/** Reads the text of the grid box: one row per line. It never throws. */
export function parseGridText(text: string, like: Level): { ok: true; level: Level } | Problems {
  if (text.length > LIMITS.maxGridChars) {
    return { ok: false, problems: [`The grid has ${text.length} characters, and the most allowed is ${LIMITS.maxGridChars}.`] };
  }
  const rows = text.split(/\r\n|\n|\r/).map((line) => line.trim());
  while (rows.length > 0 && rows[rows.length - 1] === '') rows.pop();
  if (rows.length === 0) return { ok: false, problems: ['The grid is empty. Write one row per line.'] };
  const level: Level = { id: like.id, title: like.title, maxTurns: like.maxTurns, rows };
  const checked = checkLevel(level);
  return checked.ok ? { ok: true, level } : checked;
}

// ---------- the board in words ----------

export interface MothFact {
  id: number;
  row: number;
  col: number;
  home: boolean;
  caught: boolean;
}

export interface Frame {
  /** 0 is the start board. */
  turn: number;
  action: string | null;
  played: boolean;
  phase: string;
  reason: string | null;
  hash: string;
  moths: MothFact[];
  state: Json;
  /** One sentence in plain words. */
  text: string;
  /** One line per row, one word per square. */
  squares: string[];
}

function squareWord(ch: string): string {
  if (ch === '.') return 'empty';
  if (ch === '#') return 'hedge';
  if (ch === 'w') return 'web';
  if (ch === 'f') return 'flower';
  return `lantern ${ch}`;
}

/** Rows and columns count from 1, as in the messages of the level check. */
export function squareLines(state: GardenState): string[] {
  return state.cells.map((row, y) => {
    const words = Array.from(row, (ch, x) => {
      const here = state.moths.filter((moth) => moth.x === x && moth.y === y && !moth.caught);
      const mark = here.map((moth) => (moth.home ? `moth ${moth.id} home` : `moth ${moth.id}`)).join(' and ');
      return mark === '' ? squareWord(ch) : `${squareWord(ch)} with ${mark}`;
    });
    return `Row ${y + 1}: ${words.join(', ')}`;
  });
}

function mothFacts(state: GardenState): MothFact[] {
  return state.moths.map((moth) => ({ id: moth.id, row: moth.y + 1, col: moth.x + 1, home: moth.home, caught: moth.caught }));
}

function mothWords(moth: MothFact): string {
  const at = `row ${moth.row}, column ${moth.col}`;
  if (moth.caught) return `moth ${moth.id} is caught in the web at ${at}`;
  if (moth.home) return `moth ${moth.id} is home on the flower at ${at}`;
  return `moth ${moth.id} is at ${at}`;
}

function phaseWords(phase: string, reason: string | null): string {
  if (phase === 'won') return 'The level is won.';
  if (phase === 'lost') return `The level is lost (${reason === 'web' ? 'a moth hit a web' : 'out of turns'}).`;
  return 'The level is still in play.';
}

function frameText(turn: number, maxTurns: number, action: string | null, moths: MothFact[], phase: string, reason: string | null): string {
  const head = action === null ? `Start, turn 0 of ${maxTurns}` : `Turn ${turn} of ${maxTurns}, after ${action}`;
  return `${head}: ${moths.map(mothWords).join('; ')}. ${phaseWords(phase, reason)}`;
}

/** Plays the moves on a level with a real session. A refused move ends the run and says why. */
export function playRoute(level: Level, seed: number, actions: string[]): Frame[] {
  const def = defFor(level);
  const session = createSession(def, level.id, seed);
  const frame = (turn: number, action: string | null, played: boolean, note: string | null): Frame => {
    const state = session.state as unknown as GardenState;
    const status = session.status();
    const reason = status.phase === 'lost' ? (status.reason ?? null) : null;
    const moths = mothFacts(state);
    const base = frameText(turn, state.maxTurns, action, moths, status.phase, reason);
    return {
      turn,
      action,
      played,
      phase: status.phase,
      reason,
      hash: session.hash(),
      moths,
      state: session.state,
      text: note === null ? base : `Turn ${turn}, ${action}: the move was not played. ${note}`,
      squares: squareLines(state),
    };
  };
  const frames = [frame(0, null, true, null)];
  let refused: string | null = null;
  actions.forEach((action, index) => {
    const turn = index + 1;
    if (refused !== null) {
      frames.push({ ...frame(turn, action, false, refused), hash: session.hash() });
      return;
    }
    const result = session.apply(action);
    if (result.ok) {
      frames.push(frame(turn, action, true, null));
    } else {
      refused = result.error === 'game_over' ? 'The level had already ended.' : result.message;
      frames.push(frame(turn, action, false, refused));
    }
  });
  return frames;
}

// ---------- the comparison ----------

export interface Difference {
  turn: number;
  action: string;
  text: string;
}

function signature(f: Frame): string {
  return JSON.stringify([f.played, f.phase, f.reason, f.moths.map((m) => [m.row, m.col, m.home, m.caught])]);
}

function sideWords(f: Frame): string {
  if (!f.played) return 'the move is not played';
  const moth = f.moths.find((m) => m.home || m.caught) ?? f.moths[0];
  const who = moth ? mothWords(moth) : 'no moth';
  const end = f.phase === 'won' ? 'and the level is won' : f.phase === 'lost' ? `and the level is lost (${f.reason === 'web' ? 'web' : 'turns'})` : 'and the level stays in play';
  return `${who} ${end}`;
}

/** The first move whose outcome differs. Turn 0 is the start board and is not compared. */
export function firstDifference(a: Frame[], b: Frame[]): Difference | null {
  const n = Math.min(a.length, b.length);
  for (let i = 1; i < n; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (signature(left) !== signature(right)) {
      const action = left.action ?? right.action ?? '';
      const text = `On turn ${i} (${action}) the original board: ${sideWords(left)}. The edited board: ${sideWords(right)}.`;
      return { turn: i, action, text };
    }
  }
  return null;
}

export type SearchResult =
  | { kind: 'won'; actions: string[]; text: string }
  | { kind: 'exhausted'; text: string }
  | { kind: 'inconclusive'; text: string };

/** The kit search on a level, with a cap on the states. It says win, proved exhaustion or inconclusive. */
export function searchLevel(level: Level, seed: number, cap: number = LIMITS.searchNodes): SearchResult {
  const found = solveTurn(defFor(level), level.id, seed, { ...turnOptions, maxNodes: cap });
  if (found.solved) {
    return { kind: 'won', actions: found.actions, text: `The search found a win in ${found.actions.length} moves: ${found.actions.join(', ')}.` };
  }
  if (found.reason === 'exhausted') {
    return {
      kind: 'exhausted',
      text: `The search tried every route and none wins within ${level.maxTurns} turns. This is proved for this board by the search, after ${found.nodes} states.`,
    };
  }
  return { kind: 'inconclusive', text: `Inconclusive: the search stopped after ${found.nodes} states (${found.reason}), so it cannot say whether any route wins.` };
}

export interface Comparison {
  seed: number;
  actions: string[];
  original: Frame[];
  edited: Frame[];
  difference: Difference | null;
  changed: boolean;
  /** About the saved moves only. */
  route: string;
  /** About the whole edited board, from a bounded search. */
  search: SearchResult;
}

function endWords(frames: Frame[]): string {
  const last = frames[frames.length - 1]!;
  if (last.phase === 'won') return `won on turn ${firstTurnOf(frames, 'won')}`;
  if (last.phase === 'lost') return `lost on turn ${firstTurnOf(frames, 'lost')}`;
  return `still in play after ${last.turn} turns`;
}

function firstTurnOf(frames: Frame[], phase: string): number {
  return frames.find((f) => f.phase === phase)?.turn ?? frames.length - 1;
}

/** Plays the same moves on both levels and builds the readable result. */
export function compare(original: Level, edited: Level, seed: number, actions: string[], cap: number = LIMITS.searchNodes): Comparison {
  const left = playRoute(original, seed, actions);
  const right = playRoute(edited, seed, actions);
  const difference = firstDifference(left, right);
  const moves = actions.join(', ') || 'no moves';
  const route =
    `The saved moves (${moves}) on the original board: ${endWords(left)}. On the edited board: ${endWords(right)}. ` +
    (difference === null
      ? 'Every move gives the same outcome on both boards. '
      : `${difference.text} `) +
    'This tests only these moves. It does not say whether another route wins.';
  return {
    seed,
    actions,
    original: left,
    edited: right,
    difference,
    changed: difference !== null,
    route,
    search: searchLevel(edited, seed, cap),
  };
}

/** The moves of the original level, found by the kit search. They are never written down. */
export function routeFor(level: Level, seed: number, cap: number = LIMITS.searchNodes): string[] | null {
  const found = searchLevel(level, seed, cap);
  return found.kind === 'won' ? found.actions : null;
}

// ---------- the saved file ----------

export interface CompareFile {
  format: typeof FILE_FORMAT;
  version: typeof FILE_VERSION;
  game: 'garden';
  seed: number;
  actions: string[];
  original: Level;
  edited: Level;
}

export function exportFile(original: Level, edited: Level, seed: number, actions: string[]): string {
  const file: CompareFile = {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    game: 'garden',
    seed,
    actions: [...actions],
    original: { id: original.id, title: original.title, maxTurns: original.maxTurns, rows: [...original.rows] },
    edited: { id: edited.id, title: edited.title, maxTurns: edited.maxTurns, rows: [...edited.rows] },
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

const ACTION = /^(wait|light:[1-5])$/;
const ID = /^[a-z0-9_-]{1,16}$/;

function readLevel(value: unknown, name: string, problems: string[]): Level | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    problems.push(`${name} must be an object with id, title, maxTurns and rows.`);
    return null;
  }
  const raw = value as Record<string, unknown>;
  const before = problems.length;
  if (typeof raw.id !== 'string' || !ID.test(raw.id)) problems.push(`${name}.id must be 1 to 16 letters, digits, - or _.`);
  if (typeof raw.title !== 'string' || raw.title.length > LIMITS.maxTitle) problems.push(`${name}.title must be text of at most ${LIMITS.maxTitle} characters.`);
  if (!Array.isArray(raw.rows) || raw.rows.length > 7 || raw.rows.some((row) => typeof row !== 'string' || row.length > 9)) {
    problems.push(`${name}.rows must be a list of at most 7 text rows of at most 9 characters.`);
  }
  if (problems.length > before) return null;
  const level: Level = { id: raw.id as string, title: raw.title as string, maxTurns: raw.maxTurns as number, rows: [...(raw.rows as string[])] };
  const checked = checkLevel(level);
  if (!checked.ok) {
    problems.push(...checked.problems.map((problem) => `${name}: ${problem}`));
    return null;
  }
  return level;
}

/**
 * Plays the saved moves on the original level with a real session. The route must be a winning route:
 * at least one move, none refused, a win on the last move and no move after it. It returns the reason or null.
 */
export function checkRoute(original: Level, seed: number, actions: string[]): string | null {
  if (actions.length === 0) {
    return 'The route has no moves, so it cannot be a winning route. Add the moves that win the original level, for example light:1, wait.';
  }
  const frames = playRoute(original, seed, actions);
  for (const frame of frames.slice(1)) {
    if (frame.played) continue;
    const ended = frames.slice(1, frame.turn).find((f) => f.phase !== 'playing');
    if (ended?.phase === 'won') {
      return `The original level is already won on move ${ended.turn}, but the route has ${actions.length} moves. Remove move ${ended.turn + 1} and the moves after it.`;
    }
    const why = frame.text.replace(/^.*the move was not played\. /, '');
    return `Move ${frame.turn} (${frame.action}) is refused on the original board: ${why} Fix or remove that move.`;
  }
  const last = frames[frames.length - 1]!;
  if (last.phase === 'won') return null;
  const how = last.phase === 'lost' ? `lost (${last.reason === 'web' ? 'a moth hit a web' : 'out of turns'})` : 'still in play';
  return `The route does not win the original level: after ${actions.length} moves it is ${how}. The file must hold a route that wins the original level.`;
}

/** Reads a saved file. It trusts nothing in it: every field is checked, and extra fields are dropped. */
export function importFile(text: string): { ok: true; file: CompareFile } | Problems {
  const size = new TextEncoder().encode(text).length;
  if (size > LIMITS.maxFileBytes) {
    return { ok: false, problems: [`The file has ${size} bytes, and the most allowed is ${LIMITS.maxFileBytes}.`] };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, problems: ['The file is not valid JSON.'] };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, problems: ['The file must hold one JSON object.'] };
  }
  const raw = data as Record<string, unknown>;
  const problems: string[] = [];
  if (raw.format !== FILE_FORMAT) problems.push(`The format must be "${FILE_FORMAT}".`);
  if (raw.version !== FILE_VERSION) problems.push(`The version must be ${FILE_VERSION}.`);
  if (raw.game !== 'garden') problems.push('The game must be "garden".');
  const seed = raw.seed;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > LIMITS.maxSeed) {
    problems.push(`The seed must be a whole number from 0 to ${LIMITS.maxSeed}.`);
  }
  const moves = raw.actions;
  if (!Array.isArray(moves) || moves.length > LIMITS.maxMoves || moves.some((move) => typeof move !== 'string' || !ACTION.test(move))) {
    problems.push(`The actions must be a list of at most ${LIMITS.maxMoves} moves, each "wait" or "light:1" to "light:5".`);
  }
  const original = readLevel(raw.original, 'original', problems);
  const edited = readLevel(raw.edited, 'edited', problems);
  if (problems.length > 0 || original === null || edited === null) return { ok: false, problems };
  if (original.id !== edited.id) return { ok: false, problems: ['The original and edited levels must have the same id.'] };
  const route = checkRoute(original, seed as number, moves as string[]);
  if (route !== null) return { ok: false, problems: [`actions: ${route}`] };
  return {
    ok: true,
    file: { format: FILE_FORMAT, version: FILE_VERSION, game: 'garden', seed: seed as number, actions: [...(moves as string[])], original, edited },
  };
}
