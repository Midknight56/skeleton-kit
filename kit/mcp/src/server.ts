import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { validateDef, type GameDef, type Json, type Session } from '@kit/core';
import { createStore } from './store';
import { act, newGame, observe, render, replay, type ToolContext, type ToolResult } from './tools';

/** Prints one line on standard error and ends the process. Standard output is kept for MCP messages. */
function stop(message: string): never {
  process.stderr.write(`kit-mcp: ${message}\n`);
  process.exit(1);
}

function gameFolderFromArguments(args: string[]): string {
  const at = args.indexOf('--game');
  const value = at === -1 ? undefined : args[at + 1];
  if (value === undefined || value === '' || value.startsWith('--')) {
    return stop('the --game argument is missing. Use: node server.js --game <game folder>');
  }
  return resolve(process.cwd(), value);
}

async function loadDefinition(appDir: string): Promise<GameDef<Json, unknown>> {
  const file = join(appDir, 'dist', 'def.js');
  let loaded: { default?: unknown };
  try {
    loaded = (await import(pathToFileURL(file).href)) as { default?: unknown };
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
    return stop(`cannot load ${file}: ${reason}`);
  }
  if (loaded.default === undefined || loaded.default === null) return stop(`${file} has no default export`);
  const def = loaded.default as GameDef<Json, unknown>;
  const problems = validateDef(def);
  if (problems.length > 0) return stop(`${file} is not a valid game definition: ${problems.join('; ')}`);
  return def;
}

/** Turns a handler result into an MCP tool result. */
function toToolResult(result: ToolResult): { content: { type: 'text'; text: string }[]; isError?: boolean } {
  if (!result.ok) {
    return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: result.error, message: result.message }) }] };
  }
  const text = 'text' in result ? result.text : JSON.stringify(result.value);
  return { content: [{ type: 'text', text }] };
}

function guarded(ctx: ToolContext, handler: (ctx: ToolContext, input: unknown) => ToolResult) {
  return (input: unknown) => {
    try {
      return toToolResult(handler(ctx, input));
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
      return toToolResult({ ok: false, error: 'internal_error', message: 'The tool failed. The details are on standard error.' });
    }
  };
}

// The schemas are loose on purpose. The handlers check every field and answer with the code `bad_input`,
// so a client gets the same kind of error for every bad input.
const any = (text: string) => z.unknown().optional().describe(text);

async function main(): Promise<void> {
  const appDir = gameFolderFromArguments(process.argv.slice(2));
  const def = await loadDefinition(appDir);
  const ctx: ToolContext = { def, store: createStore<Session<Json, unknown>>(), appDir };

  const server = new McpServer({ name: 'kit-mcp', version: '0.1.0' });
  server.registerTool(
    'new_game',
    {
      description:
        'Without "level": list the game id, its kind and its levels. With "level" (text) and an optional "seed" (integer 0 to 2147483647, default 1): start a session and return its id, the state and the legal actions.',
      inputSchema: { level: any('Level id, text. Leave out to list the levels.'), seed: any('Integer from 0 to 2147483647. Default 1.') },
    },
    guarded(ctx, newGame),
  );
  server.registerTool(
    'act',
    {
      description:
        'Apply actions in order. "actions" is a list of 1 to 600 action texts. "text*n" repeats one action n times, n from 2 to 3600, at most 3600 actions in all. The run stops at the first refused action and says why in "stoppedBy".',
      inputSchema: { session: any('Session id from new_game. Required.'), actions: any('List of action texts. Required.') },
    },
    guarded(ctx, act),
  );
  server.registerTool(
    'observe',
    {
      description: 'Read the current tick, status, hash, observation and legal actions of a session. Changes nothing.',
      inputSchema: { session: any('Session id from new_game. Required.') },
    },
    guarded(ctx, observe),
  );
  server.registerTool(
    'render',
    {
      description: 'Show the current state. "format" "svg" returns a 960 by 540 picture as SVG text. "format" "text" returns the summary, the text map and the legend.',
      inputSchema: { session: any('Session id from new_game. Required.'), format: any('"svg" or "text". Required.') },
    },
    guarded(ctx, render),
  );
  server.registerTool(
    'replay',
    {
      description:
        'Give "session" to get its replay, and add "save": true to also write it to tests/replays in the game folder. Give "replay" (a replay object) to run it and get the result. Give one of the two, not both.',
      inputSchema: {
        session: any('Session id from new_game.'),
        save: any('true to write the replay file. Only with "session".'),
        replay: any('A replay object to check. Only without "session".'),
      },
    },
    guarded(ctx, replay),
  );

  process.stdin.on('end', () => {
    void server.close().then(() => process.exit(0));
  });
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  stop(`unexpected failure: ${error instanceof Error ? error.message : String(error)}`);
});
