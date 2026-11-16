import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const serverFile = here('../dist/server.js');
const lightsDir = here('../test-fixtures/sample-lights');
const lightsDef = here('../test-fixtures/sample-lights/dist/def.js');

interface Talk {
  lines: string[];
  stderr: string;
  code: number | null;
}

/**
 * Starts the built server and sends the given JSON-RPC messages. Standard input is closed once a reply
 * for every message that has an id has arrived, or after 10 seconds. Returns every line written to standard output.
 */
function talk(args: string[], messages: object[], cwd: string = process.cwd()): Promise<Talk> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverFile, ...args], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const wanted = new Set<number | undefined>(messages.map((message) => (message as { id?: number }).id).filter((id) => id !== undefined));
    let out = '';
    let err = '';
    const closeInput = () => child.stdin.end();
    const timer = setTimeout(closeInput, 10000);
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8');
      for (const line of out.split('\n')) {
        try {
          wanted.delete((JSON.parse(line) as { id?: number }).id);
        } catch {
          // A partial line. It is parsed again when more data arrives.
        }
      }
      if (wanted.size === 0) closeInput();
    });
    child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString('utf8')));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ lines: out.split('\n').filter((line) => line !== ''), stderr: err, code });
    });
    child.stdin.on('error', () => undefined);
    for (const message of messages) child.stdin.write(`${JSON.stringify(message)}\n`);
    if (wanted.size === 0) setTimeout(closeInput, 500);
  });
}

const initialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '0.0.0' } },
};
const initialized = { jsonrpc: '2.0', method: 'notifications/initialized' };
const listTools = { jsonrpc: '2.0', id: 2, method: 'tools/list' };
const call = (id: number, name: string, args: object) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });

type Reply = { id?: number; result?: { tools?: { name: string }[]; isError?: boolean; content?: { type: string; text: string }[] } };
const parse = (lines: string[]) => lines.map((line) => JSON.parse(line) as Reply);
const replyTo = (lines: string[], id: number) => parse(lines).find((message) => message.id === id);
const textOf = (reply: Reply | undefined) => JSON.parse(reply?.result?.content?.[0]?.text ?? 'null') as Record<string, unknown>;

const temporary: string[] = [];
afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

/** Makes a game folder whose dist/def.js holds the given text. */
function gameFolder(defText: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'kit-mcp-game-'));
  temporary.push(dir);
  if (defText !== null) {
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'def.js'), defText, 'utf8');
  }
  return dir;
}

describe('tool door server process', () => {
  it('has been built', () => {
    expect(existsSync(serverFile), 'server not built: run npm run build -w @kit/mcp').toBe(true);
  });

  it('lists exactly the five tools', async () => {
    expect(existsSync(serverFile), 'server not built: run npm run build -w @kit/mcp').toBe(true);
    const { lines } = await talk(['--game', lightsDir], [initialize, initialized, listTools]);
    const names = (replyTo(lines, 2)?.result?.tools ?? []).map((tool) => tool.name).sort();
    expect(names).toEqual(['act', 'new_game', 'observe', 'render', 'replay']);
  }, 20000);

  it('resolves --game from the current folder', async () => {
    const { lines } = await talk(['--game', 'test-fixtures/sample-lights'], [initialize, initialized, listTools], here('..'));
    expect(replyTo(lines, 2)?.result?.tools).toHaveLength(5);
  }, 20000);

  it('writes only JSON-RPC messages to standard output', async () => {
    const messages = [
      initialize,
      initialized,
      listTools,
      call(3, 'new_game', { level: 'l1' }),
      call(4, 'act', { session: 's1', actions: ['press:1,1'] }),
      call(5, 'render', { session: 's1', format: 'svg' }),
      call(6, 'observe', { session: 's9' }),
    ];
    const { lines } = await talk(['--game', lightsDir], messages);
    expect(lines.length).toBeGreaterThanOrEqual(6);
    for (const line of lines) {
      const message = JSON.parse(line) as { jsonrpc?: string };
      expect(message.jsonrpc).toBe('2.0');
    }
    expect(textOf(replyTo(lines, 4))).toMatchObject({ applied: 1, stoppedBy: null });
    expect(replyTo(lines, 5)?.result?.content?.[0]?.text.startsWith('<svg')).toBe(true);
    expect(replyTo(lines, 6)?.result?.isError).toBe(true);
    expect(textOf(replyTo(lines, 6)).error).toBe('unknown_session');
  }, 20000);

  it('returns bad_input for a call with a missing field', async () => {
    const { lines } = await talk(['--game', lightsDir], [initialize, initialized, call(3, 'act', {}), call(4, 'new_game', { level: 3 })]);
    for (const id of [3, 4]) {
      expect(replyTo(lines, id)?.result?.isError).toBe(true);
      expect(textOf(replyTo(lines, id)).error).toBe('bad_input');
    }
  }, 20000);

  it('returns internal_error when a handler throws, writes the stack to standard error and keeps serving', async () => {
    const def = [
      `import base from ${JSON.stringify(pathToFileURL(lightsDef).href)};`,
      'export default { ...base, observe() { throw new Error("boom from observe"); } };',
      '',
    ].join('\n');
    const dir = gameFolder(def);
    const { lines, stderr } = await talk(
      ['--game', dir],
      [initialize, initialized, call(3, 'new_game', { level: 'l1' }), call(4, 'new_game', {})],
    );
    expect(replyTo(lines, 3)?.result?.isError).toBe(true);
    expect(textOf(replyTo(lines, 3)).error).toBe('internal_error');
    expect(stderr).toContain('boom from observe');
    expect(stderr).toContain('at ');
    expect(replyTo(lines, 4)?.result?.isError).not.toBe(true);
    expect(textOf(replyTo(lines, 4)).game).toBe('sample-lights');
  }, 20000);
});

describe('tool door start failures', () => {
  const cases: [string, () => string[], RegExp][] = [
    ['the --game argument is missing', () => [], /--game/],
    ['the file is missing', () => ['--game', gameFolder(null)], /def\.js/],
    ['the file has no default export', () => ['--game', gameFolder('export const other = 1;\n')], /default export/],
    ['validateDef reports a problem', () => ['--game', gameFolder('export default { id: "Bad Id" };\n')], /id:/],
  ];
  for (const [name, args, pattern] of cases) {
    it(`prints one line on standard error and exits with 1 when ${name}`, async () => {
      expect(existsSync(serverFile), 'server not built: run npm run build -w @kit/mcp').toBe(true);
      const { lines, stderr, code } = await talk(args(), []);
      expect(code).toBe(1);
      expect(lines).toEqual([]);
      expect(stderr.trim().split('\n')).toHaveLength(1);
      expect(stderr).toMatch(pattern);
    }, 20000);
  }
});
