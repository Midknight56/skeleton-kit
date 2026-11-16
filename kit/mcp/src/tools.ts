import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSession, expandActions, paintSvg, runReplay, type GameDef, type Json, type Replay, type Session } from '@kit/core';
import type { Store } from './store';

export type ErrorCode = 'unknown_session' | 'unknown_level' | 'bad_seed' | 'too_many_actions' | 'bad_input' | 'internal_error';

export type ToolResult = { ok: true; value: Record<string, unknown> } | { ok: true; text: string } | { ok: false; error: ErrorCode; message: string };

export interface ToolContext {
  def: GameDef<Json, unknown>;
  store: Store<Session<Json, unknown>>;
  /** The game folder. The only file the tool door writes is a saved replay inside it. */
  appDir: string;
}

const MAX_SEED = 2147483647;
const MAX_ITEMS = 600;
const MAX_ACTIONS = 3600;

export function fail(error: ErrorCode, message: string): ToolResult {
  return { ok: false, error, message };
}

function asRecord(input: unknown): Record<string, unknown> | undefined {
  return input !== null && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : undefined;
}

/** Looks up the session named in the input. Returns a failure result when the field is bad or the id is unknown. */
export function findSession(ctx: ToolContext, input: Record<string, unknown>): Session<Json, unknown> | ToolResult {
  const id = input.session;
  if (typeof id !== 'string' || id === '') return fail('bad_input', 'The field "session" must be a non-empty text.');
  const session = ctx.store.get(id);
  if (session === undefined) return fail('unknown_session', `There is no session "${id}". It may have been dropped.`);
  return session;
}

export function isFailure(value: Session<Json, unknown> | ToolResult): value is ToolResult {
  return 'ok' in value && (value as { ok?: unknown }).ok === false;
}

/** The part of the answer that `new_game`, `act` and `observe` share. */
export function snapshot(session: Session<Json, unknown>): Record<string, unknown> {
  return {
    tick: session.tick,
    status: session.status(),
    observation: session.def.observe(session.state),
    legal: session.legal(),
  };
}

export function newGame(ctx: ToolContext, input: unknown): ToolResult {
  const args = asRecord(input);
  if (args === undefined) return fail('bad_input', 'The input must be an object.');
  const { level, seed } = args;
  if (level !== undefined && typeof level !== 'string') return fail('bad_input', 'The field "level" must be text.');
  if (seed !== undefined && typeof seed !== 'number') return fail('bad_input', 'The field "seed" must be a number.');

  if (level === undefined) {
    return { ok: true, value: { game: ctx.def.id, kind: ctx.def.kind, levels: ctx.def.levels() } };
  }
  if (!ctx.def.levels().some((item) => item.id === level)) {
    return fail('unknown_level', `The game has no level "${level}".`);
  }
  const chosen = seed === undefined ? 1 : seed;
  if (!Number.isInteger(chosen) || chosen < 0 || chosen > MAX_SEED) {
    return fail('bad_seed', `The seed must be an integer from 0 to ${MAX_SEED}.`);
  }
  const session = createSession(ctx.def, level, chosen);
  const id = ctx.store.add(session);
  const { tick, status, observation, legal } = snapshot(session);
  return { ok: true, value: { session: id, level, seed: chosen, tick, status, observation, legal } };
}

export function observe(ctx: ToolContext, input: unknown): ToolResult {
  const args = asRecord(input);
  if (args === undefined) return fail('bad_input', 'The input must be an object.');
  const session = findSession(ctx, args);
  if (isFailure(session)) return session;
  return { ok: true, value: { ...snapshot(session), hash: session.hash() } };
}

export function act(ctx: ToolContext, input: unknown): ToolResult {
  const args = asRecord(input);
  if (args === undefined) return fail('bad_input', 'The input must be an object.');
  const session = findSession(ctx, args);
  if (isFailure(session)) return session;

  const items = args.actions;
  if (!Array.isArray(items) || items.some((item) => typeof item !== 'string')) {
    return fail('bad_input', 'The field "actions" must be a list of text items.');
  }
  if (items.length === 0) return fail('bad_input', 'The field "actions" must hold at least one item.');
  if (items.length > MAX_ITEMS) return fail('too_many_actions', `At most ${MAX_ITEMS} items are allowed in one call.`);

  // Each item is expanded on its own. A malformed item counts as one action and stops the run when it is reached.
  const plan: (string[] | null)[] = [];
  let total = 0;
  for (const item of items as string[]) {
    const expanded = expandActions([item]);
    if (expanded.ok) {
      plan.push(expanded.actions);
      total += expanded.actions.length;
    } else {
      plan.push(null);
      total += 1;
    }
  }
  if (total > MAX_ACTIONS) return fail('too_many_actions', `At most ${MAX_ACTIONS} actions are allowed in one call.`);

  let applied = 0;
  let stoppedBy: 'bad_action_text' | 'illegal_action' | 'game_over' | null = null;
  run: for (const group of plan) {
    if (group === null) {
      stoppedBy = 'bad_action_text';
      break;
    }
    for (const text of group) {
      const result = session.apply(text);
      if (!result.ok) {
        stoppedBy = result.error;
        break run;
      }
      applied += 1;
    }
  }
  return { ok: true, value: { applied, stoppedBy, ...snapshot(session), hash: session.hash() } };
}

export function render(ctx: ToolContext, input: unknown): ToolResult {
  const args = asRecord(input);
  if (args === undefined) return fail('bad_input', 'The input must be an object.');
  const session = findSession(ctx, args);
  if (isFailure(session)) return session;
  const format = args.format;
  if (format !== 'svg' && format !== 'text') return fail('bad_input', 'The field "format" must be "svg" or "text".');

  if (format === 'svg') {
    const scene = ctx.def.view(session.state, { width: 960, height: 540, safe: { top: 0, right: 0, bottom: 0, left: 0 } });
    return { ok: true, text: paintSvg(scene) };
  }
  const observation = ctx.def.observe(session.state);
  const blocks: string[] = [observation.summary];
  if (observation.textMap !== undefined && observation.textMap.length > 0) {
    blocks.push(observation.textMap.join('\n'));
    if (observation.legend !== undefined) {
      blocks.push(Object.entries(observation.legend).map(([char, meaning]) => `${char} = ${meaning}`).join('\n'));
    }
  }
  return { ok: true, text: blocks.join('\n\n') };
}

export function replay(ctx: ToolContext, input: unknown): ToolResult {
  const args = asRecord(input);
  if (args === undefined) return fail('bad_input', 'The input must be an object.');
  const hasSession = args.session !== undefined;
  const hasReplay = args.replay !== undefined;
  if (hasSession === hasReplay) return fail('bad_input', 'Give either "session" or "replay", and not both.');

  if (hasReplay) {
    const given = asRecord(args.replay);
    if (given === undefined) return fail('bad_input', 'The field "replay" must be a replay object.');
    return { ok: true, value: { ...runReplay(ctx.def, given as unknown as Replay) } };
  }

  const save = args.save;
  if (save !== undefined && typeof save !== 'boolean') return fail('bad_input', 'The field "save" must be true or false.');
  const session = findSession(ctx, args);
  if (isFailure(session)) return session;
  const result = session.toReplay();
  if (save !== true) return { ok: true, value: { replay: result } };

  // The only file the tool door writes.
  const folder = join(ctx.appDir, 'tests', 'replays');
  const file = join(folder, `${result.game}-${result.level}-${result.finalHash}.json`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return { ok: true, value: { replay: result, file } };
}