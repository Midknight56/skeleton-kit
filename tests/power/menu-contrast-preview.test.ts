import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, describe, expect, it } from 'vitest';

// Requirements of .kiro/specs/menu-contrast-preview. The tests start the server that
// power/menu-contrast-preview/mcp.json configures, from an empty folder, as an MCP client would.

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const POWER = ['power', 'menu-contrast-preview'];

const text = (...parts: string[]): string => readFileSync(join(REPO, ...parts), 'utf8');
const json = <T>(...parts: string[]): T => JSON.parse(text(...parts)) as T;

interface ServerConfig {
  type?: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}
const config = (): ServerConfig => {
  const servers = json<{ mcpServers: Record<string, ServerConfig> }>(...POWER, 'mcp.json').mcpServers;
  return servers['contrast'] as ServerConfig;
};

// The environment of the configured server: each `${NAME}` takes its value from `values`.
function envOf(values: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(config().env ?? {})) {
    const match = /^\$\{(\w+)\}$/.exec(value);
    const found = match ? values[match[1] as string] : value;
    if (found !== undefined) env[name] = found;
  }
  return env;
}

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function connect(values: Record<string, string> = { SKELETON_KIT_ROOT: REPO }): Promise<Client> {
  const cwd = mkdtempSync(join(tmpdir(), 'menu-contrast-'));
  cleanups.push(() => rmSync(cwd, { recursive: true, force: true }));
  const transport = new StdioClientTransport({ command: config().command, args: config().args, env: envOf(values), cwd, stderr: 'pipe' });
  const client = new Client({ name: 'menu-contrast-test', version: '0.0.0' });
  cleanups.push(() => client.close());
  await client.connect(transport);
  return client;
}

describe('2 the real colour changes', () => {
  interface Row {
    name: string;
    currentRatio: number;
    proposedRatio: number;
    minimum: number;
    currentResult: string;
    proposedResult: string;
  }
  interface Preview {
    game: string;
    field: string;
    current: string;
    proposed: string;
    pairsChecked: number;
    newFailureCount: number;
    newFailures: string[];
    existingFailures: string[];
    rows: Row[];
  }

  async function ask(args: Record<string, unknown>): Promise<Preview> {
    const client = await connect();
    const result = await client.callTool({ name: 'preview_menu_contrast', arguments: args });
    expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
    return JSON.parse(((result.content as { text: string }[])[0] as { text: string }).text) as Preview;
  }

  it('2.4 2.5 the garden glow #ff8a1f4d gives exactly three new failures, from 4.51 to 4.06 against 4.50', async () => {
    const preview = await ask({ game: 'garden', field: 'glow', colour: '#ff8a1f4d' });
    expect(preview.pairsChecked).toBe(27);
    expect(preview.rows).toHaveLength(27);
    expect(preview.current).toBe('#ff8a1f41');
    expect(preview.proposed).toBe('#ff8a1f4d');
    expect(preview.newFailureCount).toBe(3);
    expect(preview.existingFailures).toEqual([]);
    const names = ['storage notice on the sky', 'result reason on the sky', 'watch proof line on the sky'].map((name) => `garden: ${name}`);
    expect([...preview.newFailures].sort()).toEqual([...names].sort());
    for (const name of names) {
      const row = preview.rows.find((r) => r.name === name);
      expect(row, name).toEqual({ name, currentRatio: 4.51, proposedRatio: 4.06, minimum: 4.5, currentResult: 'pass', proposedResult: 'fail' });
    }
    expect(preview.rows.filter((r) => r.proposedResult === 'fail')).toHaveLength(3);
  });

  it('2.4 2.6 the runner accent #33285c puts the filled level marker at 1.00 against 3.00', async () => {
    const preview = await ask({ game: 'runner', field: 'accent', colour: '#33285c' });
    expect(preview.pairsChecked).toBe(27);
    expect(preview.rows).toHaveLength(27);
    expect(preview.current).toBe('#efe7d2');
    expect(preview.proposed).toBe('#33285c');
    const name = 'runner: level card filled pip on the card fill';
    expect(preview.rows.find((r) => r.name === name)).toEqual({ name, currentRatio: 10.65, proposedRatio: 1, minimum: 3, currentResult: 'pass', proposedResult: 'fail' });
    expect(preview.newFailures).toContain(name);
    expect(preview.newFailureCount).toBe(preview.newFailures.length);
  });

  it('2.3 a pass is never shown with a ratio under its minimum', async () => {
    for (const args of [{ game: 'garden', field: 'glow', colour: '#ff8a1f4d' }, { game: 'runner', field: 'accent', colour: '#33285c' }]) {
      const preview = await ask(args);
      for (const row of preview.rows) {
        if (row.proposedResult === 'pass') expect(row.proposedRatio, row.name).toBeGreaterThanOrEqual(row.minimum);
        if (row.currentResult === 'pass') expect(row.currentRatio, row.name).toBeGreaterThanOrEqual(row.minimum);
      }
    }
  });
});

describe('3 read only and invalid input', () => {
  const FILES = [['apps', 'garden', 'theme.ts'], ['apps', 'runner', 'theme.ts'], ['docs', 'acceptance', 'a11y', 'contrast.json'], ['tests', 'a11y', 'contrast-pairs.ts']];
  const snapshot = (): string[] => FILES.map((file) => createHash('sha256').update(readFileSync(join(REPO, ...file))).digest('hex'));

  async function call(args: Record<string, unknown>): Promise<{ isError: boolean; body: Record<string, unknown> }> {
    const client = await connect();
    const result = await client.callTool({ name: 'preview_menu_contrast', arguments: args });
    const body = JSON.parse(((result.content as { text: string }[])[0] as { text: string }).text) as Record<string, unknown>;
    return { isError: result.isError === true, body };
  }

  it('3.3 the current garden glow gives zero new failures and the files stay as they were', async () => {
    const before = snapshot();
    const { isError, body } = await call({ game: 'garden', field: 'glow', colour: '#ff8a1f41' });
    expect(isError).toBe(false);
    expect(body.pairsChecked).toBe(27);
    expect(body.newFailureCount).toBe(0);
    expect(body.newFailures).toEqual([]);
    expect(body.existingFailures).toEqual([]);
    expect(snapshot()).toEqual(before);
  });

  const bad: [string, Record<string, unknown>, string][] = [
    ['an unknown game', { game: 'moon', field: 'glow', colour: '#ff8a1f4d' }, 'game'],
    ['a missing game', { field: 'glow', colour: '#ff8a1f4d' }, 'game'],
    ['a game that is not text', { game: 7, field: 'glow', colour: '#ff8a1f4d' }, 'game'],
    ['an unknown field', { game: 'garden', field: 'sparkle', colour: '#ff8a1f' }, 'field'],
    ['a missing field', { game: 'garden', colour: '#ff8a1f' }, 'field'],
    ['a field with the wrong case', { game: 'garden', field: 'Glow', colour: '#ff8a1f' }, 'field'],
    ['a colour name', { game: 'garden', field: 'glow', colour: 'orange' }, 'colour'],
    ['a colour of 5 digits', { game: 'garden', field: 'glow', colour: '#ff8a1' }, 'colour'],
    ['a colour with no hash', { game: 'runner', field: 'accent', colour: '33285c' }, 'colour'],
    ['a colour with opacity digits for a palette field', { game: 'runner', field: 'accent', colour: '#33285c4d' }, 'colour'],
    ['a missing colour', { game: 'runner', field: 'accent' }, 'colour'],
    ['a colour that is not text', { game: 'runner', field: 'accent', colour: 255 }, 'colour'],
  ];
  for (const [label, args, field] of bad) {
    it(`3.1 3.2 ${label} gives an error that names the field ${field}, and the files stay as they were`, async () => {
      const before = snapshot();
      const { isError, body } = await call(args);
      expect(isError).toBe(true);
      expect(body.error).toBe('bad_input');
      expect(body.field).toBe(field);
      expect(String(body.message)).toContain(field);
      expect(body).not.toHaveProperty('rows');
      expect(snapshot()).toEqual(before);
    });
  }

  it('3.1 the opacity form is accepted for glow only, and each palette name is accepted', async () => {
    expect((await call({ game: 'garden', field: 'glow', colour: '#ff8a1f' })).isError).toBe(false);
    for (const name of ['background', 'surface', 'primary', 'secondary', 'accent', 'text', 'muted', 'danger']) {
      const { isError, body } = await call({ game: 'garden', field: name, colour: '#336699' });
      expect(isError, `${name}: ${JSON.stringify(body)}`).toBe(false);
      expect(body.pairsChecked).toBe(27);
    }
  });

  it('3.4 the call writes no file in the folder it runs in', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'menu-contrast-cwd-'));
    cleanups.push(() => rmSync(cwd, { recursive: true, force: true }));
    const transport = new StdioClientTransport({ command: config().command, args: config().args, env: envOf({ SKELETON_KIT_ROOT: REPO }), cwd, stderr: 'pipe' });
    const client = new Client({ name: 'menu-contrast-test', version: '0.0.0' });
    cleanups.push(() => client.close());
    await client.connect(transport);
    await client.callTool({ name: 'preview_menu_contrast', arguments: { game: 'garden', field: 'glow', colour: '#ff8a1f4d' } });
    expect(readdirSync(cwd)).toEqual([]);
  });
});

describe('1 the package and the launch', () => {
  it('1.1 plugin.json has the fields of the design and the schema of the existing power', () => {
    const plugin = json<Record<string, unknown>>(...POWER, 'plugin.json');
    const existing = json<Record<string, unknown>>('power', 'skeleton-kit', 'plugin.json');
    expect(plugin.$schema).toBe(existing.$schema);
    expect(plugin.name).toBe('menu-contrast-preview');
    expect(plugin.version).toBe('0.1.0');
    expect(plugin.description).toBe('Try a theme colour in the garden or runner and see which menu labels or controls fall below their contrast limit.');
    expect(plugin.author).toEqual({ name: 'Adrian Ferguson' });
    expect(plugin.keywords).toEqual(['menu contrast', 'sky glow', 'palette change', 'theme colour']);
    expect(plugin.repository).toBe(existing.repository);
    expect(plugin.license).toBe(existing.license);
  });

  it('1.2 mcp.json has one stdio server named contrast that reads SKELETON_KIT_ROOT and holds no path of this machine', () => {
    const mcp = json<{ mcpServers: Record<string, ServerConfig> }>(...POWER, 'mcp.json');
    expect(Object.keys(mcp.mcpServers)).toEqual(['contrast']);
    const server = config();
    expect(server.type).toBe('stdio');
    expect(server.command).toBe('node');
    expect(server.args[0]).toBe('-e');
    expect(server.env).toEqual({ SKELETON_KIT_ROOT: '${SKELETON_KIT_ROOT}' });
    const launcher = server.args[1] ?? '';
    expect(launcher).toContain('process.exit(1)');
    expect(launcher).toContain('console.error');
    expect(launcher).toContain('power');
    expect(launcher).toContain('menu-contrast-preview');
    expect(launcher).toContain('server.mjs');
    const raw = text(...POWER, 'mcp.json');
    expect(raw).not.toMatch(/(^|[^A-Za-z])[A-Za-z]:[\\/]/);
    expect(raw).not.toMatch(/adria/i);
  });

  it('1.3 the launcher exits 1 with a readable message when SKELETON_KIT_ROOT is missing or empty', () => {
    const clean = { ...process.env };
    delete clean.SKELETON_KIT_ROOT;
    for (const env of [clean, { ...clean, SKELETON_KIT_ROOT: '' }]) {
      const run = spawnSync('node', ['-e', config().args[1] ?? ''], { env, encoding: 'utf8' });
      expect(run.status).toBe(1);
      expect(run.stderr).toContain('SKELETON_KIT_ROOT');
      expect(run.stderr).toMatch(/set SKELETON_KIT_ROOT to the full path/);
      expect(run.stdout).toBe('');
    }
  });

  it('1.3 the launcher names a folder that holds no server file', () => {
    const empty = mkdtempSync(join(tmpdir(), 'menu-contrast-empty-'));
    cleanups.push(() => rmSync(empty, { recursive: true, force: true }));
    const run = spawnSync('node', ['-e', config().args[1] ?? ''], { env: { ...process.env, SKELETON_KIT_ROOT: empty }, encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('server.mjs');
  });

  it('1.4 the skill has the description and the three steps of the design', () => {
    const body = text(...POWER, 'skills', 'preview-menu-colour', 'SKILL.md');
    const front = /^---\n([\s\S]*?)\n---\n/.exec(body);
    expect(front, 'front matter').not.toBeNull();
    expect(front?.[1]).toMatch(/^name: preview-menu-colour$/m);
    expect(front?.[1]).toMatch(/^description: Use when someone wants to try a menu colour or sky glow before editing the garden or runner theme\.$/m);
    expect(body).toContain('`preview_menu_contrast`');
    expect(body).toMatch(/^1\. /m);
    expect(body).toMatch(/^2\. /m);
    expect(body).toMatch(/^3\. /m);
    expect(body).toMatch(/Artwork drawn inside the game has separate checks/);
  });

  it('1.5 the server started from an empty folder offers exactly one tool, preview_menu_contrast', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(['preview_menu_contrast']);
  });

  it('1.5 the files of the package hold plain words: no dash between words', () => {
    for (const file of [['plugin.json'], ['mcp.json'], ['skills', 'preview-menu-colour', 'SKILL.md'], ['server.mjs']]) {
      const body = text(...POWER, ...file);
      expect(body, file.join('/')).not.toMatch(/\s[\u2013\u2014-]\s|[\u2013\u2014]/);
    }
  });
});
