import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Requirements of .kiro/specs/kiro-extensions. The test reads files only. It starts no Kiro session.

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function text(...parts: string[]): string {
  return readFileSync(join(REPO, ...parts), 'utf8');
}
function json<T>(...parts: string[]): T {
  return JSON.parse(text(...parts)) as T;
}

/** The tool names that kit/mcp/src/server.ts registers, read from its registerTool calls. */
function serverTools(): string[] {
  const source = text('kit', 'mcp', 'src', 'server.ts');
  return [...source.matchAll(/registerTool\(\s*'(\w+)'/g)].map((match) => match[1] as string);
}

const POWER = ['power', 'skeleton-kit'];
const FIVE = ['new_game', 'act', 'observe', 'render', 'replay'];
const WRITE_OR_SHELL = /^(write|fs_write|fs_append|edit|str_replace|shell|bash|execute_bash|execute_pwsh|execute|delete|code|knowledge|@builtin|\*|@\*)$/i;

describe('the tool door (the source of tool names)', () => {
  it('registers new_game, act, observe, render and replay', () => {
    expect(serverTools()).toEqual(FIVE);
  });
});

describe('1 the power in power/skeleton-kit', () => {
  it('1.1 has a plugin.json with the required fields', () => {
    const plugin = json<Record<string, unknown>>(...POWER, 'plugin.json');
    expect(plugin.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
    expect(plugin.name).toBe('skeleton-kit');
    expect(plugin.version).toMatch(/^0\.\d+\.\d+$/);
    expect(typeof plugin.description).toBe('string');
    expect((plugin.description as string).length).toBeGreaterThan(20);
    expect(typeof (plugin.author as { name?: unknown }).name).toBe('string');
    const keywords = plugin.keywords as string[];
    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords.length).toBeGreaterThanOrEqual(4);
    for (const word of keywords) expect(word.trim()).not.toBe('');
  });

  it('1.2 has an mcp.json that reads two variables, checks them and holds no path of this machine', () => {
    const mcp = json<{ mcpServers: Record<string, { type?: string; command: string; args?: string[]; env?: Record<string, string> }> }>(
      ...POWER,
      'mcp.json',
    );
    const servers = Object.values(mcp.mcpServers);
    expect(servers).toHaveLength(1);
    const server = servers[0];
    expect(server?.command).toBe('node');
    const raw = text(...POWER, 'mcp.json');
    expect(raw).toContain('SKELETON_KIT_MCP_DIST');
    expect(raw).toContain('SKELETON_KIT_GAME');
    expect(server?.env?.SKELETON_KIT_MCP_DIST).toBe('${SKELETON_KIT_MCP_DIST}');
    expect(server?.env?.SKELETON_KIT_GAME).toBe('${SKELETON_KIT_GAME}');
    const launcher = server?.args?.[1] ?? '';
    expect(server?.args?.[0]).toBe('-e');
    expect(launcher).toContain('process.exit(1)');
    expect(launcher).toContain('console.error');
    expect(launcher).toContain('--game');
    expect(raw).not.toMatch(/(^|[^A-Za-z])[A-Za-z]:[\\/]/); // a drive path such as D:/ or C:\, not the s:// of https://
    expect(raw).not.toMatch(/adria/i);
    expect(server?.args).not.toContain('kit/mcp/dist/server.js'); // no relative path into a clone
  });

  it('1.2 the launcher exits 1 with a message when a variable is missing', async () => {
    const { spawnSync } = await import('node:child_process');
    const mcp = json<{ mcpServers: Record<string, { args: string[] }> }>(...POWER, 'mcp.json');
    const launcher = Object.values(mcp.mcpServers)[0]?.args[1] ?? '';
    const clean = { ...process.env };
    delete clean.SKELETON_KIT_MCP_DIST;
    delete clean.SKELETON_KIT_GAME;
    for (const env of [clean, { ...clean, SKELETON_KIT_MCP_DIST: 'x' }, { ...clean, SKELETON_KIT_GAME: 'x' }]) {
      const run = spawnSync('node', ['-e', launcher], { env, encoding: 'utf8' });
      expect(run.status).toBe(1);
      expect(run.stderr).toContain('SKELETON_KIT_MCP_DIST');
      expect(run.stderr).toContain('SKELETON_KIT_GAME');
    }
  });

  it('1.5 names exactly the five tools of the tool door in the README and the skill', () => {
    const real = serverTools();
    for (const file of [[...POWER, 'README.md'], [...POWER, 'skills', 'play-and-prove', 'SKILL.md']]) {
      const body = text(...file);
      for (const tool of real) expect(body, `${file.join('/')} names ${tool}`).toContain('`' + tool + '`');
      // Every backticked snake_case word that looks like a tool call must be a real tool.
      for (const match of body.matchAll(/`([a-z]+(?:_[a-z]+)*)\(/g)) {
        expect(real, `tool ${match[1]} in ${file.join('/')}`).toContain(match[1]);
      }
    }
  });

  it('2 has the skill play-and-prove with the rules of a player', () => {
    const skills = join(REPO, ...POWER, 'skills');
    const folders = readdirSync(skills, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    expect(folders.map((folder) => folder.name)).toEqual(['play-and-prove']);
    const body = text(...POWER, 'skills', 'play-and-prove', 'SKILL.md');
    const front = /^---\n([\s\S]*?)\n---\n/.exec(body);
    expect(front, 'front matter').not.toBeNull();
    expect(front?.[1]).toMatch(/^name: play-and-prove$/m);
    expect(front?.[1]).toMatch(/^description: .*\b(use|when)\b/im);
    expect(body).toContain('npm run prove');
    expect(body).toMatch(/won/);
    expect(body).toMatch(/legal/i);
    expect(body).toMatch(/seed plus actions/i);
    expect(body).toMatch(/proofs\//);
    expect(body).toMatch(/holds no word of a game/i);
    expect(body).toMatch(/proof is not a claim about fun or safety/i);
  });

  it('3 has a README with the install command, the uninstall command, the needs and the variables', () => {
    const readme = text(...POWER, 'README.md');
    expect(readme).toContain('kiro-cli powers install');
    expect(readme).toContain('kiro-cli powers uninstall skeleton-kit');
    expect(readme).toContain('Node 24 or later');
    expect(readme).toContain('npm install');
    expect(readme).toContain('npm run build:kit');
    expect(readme).toContain('npm run build:apps');
    expect(readme).toContain('SKELETON_KIT_MCP_DIST');
    expect(readme).toContain('SKELETON_KIT_GAME');
    expect(readme).toContain('kit/mcp/dist/server.js');
    expect(readme).not.toMatch(/(^|[^A-Za-z])[A-Za-z]:[\\/]/);
  });
});

describe('4 the custom agents in .kiro/agents', () => {
  interface Agent {
    name: string;
    tools: string[];
    allowedTools?: string[];
    permissions?: { rules?: { capability: string; effect: string }[] };
  }
  const servers = Object.keys(json<{ mcpServers: Record<string, unknown> }>('.kiro', 'settings', 'mcp.json').mcpServers);

  for (const file of ['playtester.json', 'runner-playtester.json']) {
    it(`${file} parses, lists only read and known @ tools, and has no write or shell tool`, () => {
      const agent = json<Agent>('.kiro', 'agents', file);
      expect(agent.tools.length).toBeGreaterThanOrEqual(2);
      expect(agent.tools).toContain('read');
      for (const tool of [...agent.tools, ...(agent.allowedTools ?? [])]) {
        expect(tool, tool).not.toMatch(WRITE_OR_SHELL);
        if (tool === 'read') continue;
        expect(tool, tool).toMatch(/^@[a-z0-9_-]+(\/\w+)?$/);
        const server = tool.slice(1).split('/')[0] as string;
        expect(servers, `server of ${tool}`).toContain(server);
      }
      for (const rule of agent.permissions?.rules ?? []) {
        expect(['shell', 'write', 'edit', 'fs_write'], `rule ${rule.capability}`).not.toContain(rule.capability);
      }
    });
  }
});

describe('5 the proof that the power ran in one headless session', () => {
  const dir = ['docs', 'acceptance', 'power-session'];

  it('5.1 has a README and the saved session output', () => {
    expect(existsSync(join(REPO, ...dir, 'README.md'))).toBe(true);
    expect(existsSync(join(REPO, ...dir, 'session-output.txt'))).toBe(true);
  });

  it('5.2 the README shows the commands, the uninstall, the tool calls seen and the limits', () => {
    const proof = text(...dir, 'README.md');
    expect(proof).toContain('kiro-cli powers install power/skeleton-kit');
    expect(proof).toContain('kiro-cli powers uninstall skeleton-kit');
    expect(proof).toContain('--no-interactive');
    expect(proof).toContain('installedPowers');
    expect(proof).toMatch(/## Tool calls seen/);
    expect(proof).toMatch(/## Limits/);
    expect(proof).toMatch(/## What did not work first/);
    expect(proof).toMatch(/## How the answer was checked/);
    expect(proof).not.toMatch(/(^|[^A-Za-z])[A-Za-z]:[\\/]Users/);
  });

  it('5.3 the session output is not empty', () => {
    expect(text(...dir, 'session-output.txt').trim().length).toBeGreaterThan(100);
  });
});

describe('6 the README claims', () => {
  const readme = text('README.md');
  const powers = /\*\*Kiro powers\.\*\*([\s\S]*?)\n\n## /.exec(readme)?.[1] ?? '';
  const first = readme.split('\n\n').find((block) => block.startsWith('Built with Kiro')) ?? '';

  it('6.1 the section Kiro powers names the power and the proof folder, and each file exists', () => {
    expect(powers).toContain('`power/skeleton-kit/`');
    expect(powers).toContain('`docs/acceptance/power-session/`');
    expect(powers).not.toContain('Not used in this build');
    for (const file of powers.matchAll(/`((?:power|docs)\/[^`\s]+)`/g)) {
      expect(existsSync(join(REPO, file[1] as string)), file[1]).toBe(true);
    }
  });

  it('6.2 the first paragraph lists the power among what Kiro wrote', () => {
    expect(first).toMatch(/two powers/);
    expect(readme).toContain('`power/skeleton-kit/`');
    expect(readme).toContain('`power/menu-contrast-preview/`');
  });

  it('6.3 has no dash between words in the section', () => {
    expect(powers).not.toMatch(/\s[\u2013\u2014-]\s|[\u2013\u2014]/);
  });
});

describe('7 the proof that the menu contrast power ran in one headless session', () => {
  const file = ['docs', 'acceptance', 'menu-contrast-preview', 'README.md'];

  it('7.1 has a README', () => {
    expect(existsSync(join(REPO, ...file))).toBe(true);
  });

  it('7.2 holds the tool call line, a later completed line and the three garden rows', () => {
    const proof = text(...file);
    const call = proof.indexOf('[tool] @menu-contrast-preview/contrast/preview_menu_contrast');
    expect(call).toBeGreaterThanOrEqual(0);
    expect(proof.indexOf('[tool] status: Completed', call)).toBeGreaterThan(call);
    for (const label of ['Storage notice on the sky', 'Result reason on the sky', 'Watch proof line on the sky']) {
      const row = proof.split('\n').find((line) => line.startsWith('| ' + label));
      expect(row, label).toBeDefined();
      const cells = (row as string).split('|').map((cell) => cell.trim());
      expect(cells.slice(2, 5), label).toEqual(['4.51', '4.06', '4.5']);
    }
  });
});
