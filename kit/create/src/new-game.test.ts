import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, rmdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { newGame } from './new-game';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const templateDir = fileURLToPath(new URL('../template', import.meta.url));
const made: string[] = [];

function tempRoot(games: string[] = ['apps/one', 'apps/two']): string {
  const root = mkdtempSync(join(tmpdir(), 'new-game-'));
  made.push(root);
  writeFileSync(join(root, 'kit.config.json'), `{\n  "games": [${games.map((g) => JSON.stringify(g)).join(', ')}]\n}\n`, 'utf8');
  return root;
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

// Every file of a folder with its text, so that two snapshots can be compared.
function snapshot(root: string): Record<string, string> {
  return Object.fromEntries(files(root).map((file) => [relative(root, file).split('\\').join('/'), readFileSync(file, 'utf8')]));
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('new:game with a good id', () => {
  it('creates apps/<id> from the template, adds it to kit.config.json and prints the next three commands', () => {
    const root = tempRoot();
    const result = newGame(root, 'lights');
    expect(result.code).toBe(0);
    expect(result.err).toEqual([]);
    expect(existsSync(join(root, 'apps', 'lights', 'package.json'))).toBe(true);
    expect(existsSync(join(root, 'apps', 'lights', 'src', 'def.ts'))).toBe(true);
    expect(JSON.parse(readFileSync(join(root, 'kit.config.json'), 'utf8')).games).toEqual(['apps/one', 'apps/two', 'apps/lights']);
    const printed = result.out.join('\n');
    const at = ['npm install', 'npm run prove', 'npm run verify'].map((command) => printed.indexOf(command));
    expect(at.every((i) => i >= 0), printed).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('puts the id in the package name, the game id and the proof path, and the product name only in game.config.ts', () => {
    const root = tempRoot();
    newGame(root, 'my-lights');
    const app = join(root, 'apps', 'my-lights');
    expect(JSON.parse(readFileSync(join(app, 'package.json'), 'utf8')).name).toBe('@app/my-lights');
    expect(readFileSync(join(app, 'src', 'def.ts'), 'utf8')).toContain("id: 'my-lights'");
    expect(readFileSync(join(app, 'src', 'main.ts'), 'utf8')).toContain('../proofs/my-lights/');
    expect(readFileSync(join(app, 'game.config.ts'), 'utf8')).toContain("title: 'My lights'");
    const others = files(app).filter((f) => !f.endsWith('game.config.ts') && !f.endsWith('package.json') && readFileSync(f, 'utf8').includes('My lights'));
    expect(others.map((f) => relative(app, f))).toEqual([]);
  });

  it('leaves no .tpl file and no unfilled token, and ends every file name as the template says without .tpl', () => {
    const root = tempRoot();
    newGame(root, 'lights');
    const created = files(join(root, 'apps', 'lights'));
    expect(created.length).toBeGreaterThan(8);
    for (const file of created) {
      expect(file.endsWith('.tpl'), file).toBe(false);
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/__[A-Z]+__/);
    }
    const expected = files(templateDir).map((f) => relative(templateDir, f).replace(/\.tpl$/, ''));
    expect(created.map((f) => relative(join(root, 'apps', 'lights'), f)).sort()).toEqual(expected.sort());
  });

  it('writes every created file as UTF-8 with no byte order mark and no CR', () => {
    const root = tempRoot();
    newGame(root, 'lights');
    const all = [...files(join(root, 'apps', 'lights')), join(root, 'kit.config.json')];
    for (const file of all) {
      const bytes = readFileSync(file);
      expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), `${file} has a byte order mark`).toBe(false);
      expect(bytes.includes(13), `${file} has a CR`).toBe(false);
      expect(bytes.at(-1), `${file} ends with a new line`).toBe(10);
    }
  });
});

describe('new:game with a bad id', () => {
  const bad = ['', 'Lights', 'my game', '-lights', 'lights_2', '../lights', 'a/b', 'a\\b', 'lights.', 'ligh\u00e9ts', '.'];

  it.each(bad.map((id) => [JSON.stringify(id), id]))('changes nothing and exits 1 for the id %s', (_name, id) => {
    const root = tempRoot();
    const before = snapshot(root);
    const result = newGame(root, id);
    expect(result.code).toBe(1);
    expect(result.err.length).toBeGreaterThan(0);
    expect(result.out).toEqual([]);
    expect(snapshot(root)).toEqual(before);
    expect(existsSync(join(root, 'apps'))).toBe(false);
  });

  it('changes nothing and exits 1 when no id is given', () => {
    const root = tempRoot();
    const before = snapshot(root);
    expect(newGame(root, undefined).code).toBe(1);
    expect(snapshot(root)).toEqual(before);
  });
});

describe('new:game with an id that is in use', () => {
  it('exits 1 and changes nothing when apps/<id> exists', () => {
    const root = tempRoot();
    mkdirSync(join(root, 'apps', 'lights'), { recursive: true });
    writeFileSync(join(root, 'apps', 'lights', 'keep.txt'), 'mine\n', 'utf8');
    const before = snapshot(root);
    const result = newGame(root, 'lights');
    expect(result.code).toBe(1);
    expect(result.err.join(' ')).toContain('lights');
    expect(snapshot(root)).toEqual(before);
  });

  it('exits 1 and changes nothing when the id is a game of kit.config.json', () => {
    const root = tempRoot(['apps/one', 'kit/solver/test-fixtures/lights']);
    const before = snapshot(root);
    expect(newGame(root, 'one').code).toBe(1);
    expect(newGame(root, 'lights').code).toBe(1);
    expect(snapshot(root)).toEqual(before);
  });

  it('exits 1 the second time for the same id', () => {
    const root = tempRoot();
    expect(newGame(root, 'lights').code).toBe(0);
    const before = snapshot(root);
    expect(newGame(root, 'lights').code).toBe(1);
    expect(snapshot(root)).toEqual(before);
  });

  it('exits 1 and changes nothing when kit.config.json is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'new-game-'));
    made.push(root);
    expect(newGame(root, 'lights').code).toBe(1);
    expect(readdirSync(root)).toEqual([]);
  });
});

describe('the template', () => {
  // The kit never contains a word from a game, and the template is part of the kit. The words are
  // written in two parts, so that a search of kit/ for them does not find this test file.
  const gameWords = [['mo', 'th'], ['lan', 'tern'], ['flo', 'wer'], ['w', 'eb'], ['bro', 'om'], ['pump', 'kin'], ['can', 'dle'], ['ga', 'te']].map((parts) => parts.join(''));

  it('holds no game word of the repository', () => {
    const found: string[] = [];
    for (const file of files(templateDir)) {
      const text = `${relative(templateDir, file)}\n${readFileSync(file, 'utf8')}`.toLowerCase();
      for (const word of gameWords) if (text.includes(word)) found.push(`${relative(templateDir, file)}: ${word}`);
    }
    expect(found).toEqual([]);
  });

  it('has only .tpl files, with LF line endings and no byte order mark', () => {
    for (const file of files(templateDir)) {
      expect(file.endsWith('.tpl'), file).toBe(true);
      const bytes = readFileSync(file);
      expect(bytes.includes(13), `${file} has a CR`).toBe(false);
      expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), `${file} has a byte order mark`).toBe(false);
    }
  });
});

// The copy of the repository: no node_modules (it is linked with a junction), no built files, no history.
const skipped = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report']);

function run(command: string, cwd: string): { status: number | null; text: string } {
  const result = spawnSync(command, { cwd, shell: true, encoding: 'utf8', env: { ...process.env, KIT_NEW_GAME_COPY: '1' }, maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, text: `${result.stdout}\n${result.stderr}` };
}

// The copy runs its own test suite in `npm run verify`, and this test would start another copy there.
describe.skipIf(process.env.KIT_NEW_GAME_COPY === '1')('a copy of the repository', { timeout: 1_500_000 }, () => {
  it('makes a game with new:game that passes prove and then verify with no edit', () => {
    const copy = mkdtempSync(join(tmpdir(), 'kit-copy-'));
    made.push(copy);
    const modules = join(repoRoot, 'node_modules');
    cpSync(repoRoot, copy, { recursive: true, filter: (source) => !skipped.has(source.split(/[\\/]/).at(-1) ?? '') });
    symlinkSync(modules, join(copy, 'node_modules'), 'junction');
    try {
      const made1 = run('npm run new:game -- lights', copy);
      expect(made1.status, made1.text).toBe(0);
      for (const command of ['npm install', 'npm run prove', 'npm run verify']) expect(made1.text).toContain(command);
      expect(existsSync(join(copy, 'apps', 'lights', 'src', 'def.ts'))).toBe(true);

      const proved = run('npm run prove', copy);
      expect(proved.status, proved.text.slice(-3000)).toBe(0);
      expect(existsSync(join(copy, 'proofs', 'lights', 'index.json'))).toBe(true);

      const verified = run('npm run verify', copy);
      expect(verified.status, verified.text.slice(-3000)).toBe(0);
    } finally {
      // Remove the junction first, so that nothing is deleted through it.
      if (lstatSync(join(copy, 'node_modules')).isSymbolicLink()) rmdirSync(join(copy, 'node_modules'));
    }
    expect(existsSync(join(modules, 'vitest'))).toBe(true);
  });
});
