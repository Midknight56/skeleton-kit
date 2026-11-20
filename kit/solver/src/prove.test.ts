import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const proveFile = here('../dist/prove.js');
const fixture = (name: string) => here(`../test-fixtures/${name}`);

const temporary: string[] = [];
afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function workFolder(games: string[] | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'kit-prove-'));
  temporary.push(dir);
  if (games !== null) writeFileSync(join(dir, 'kit.config.json'), `${JSON.stringify({ games }, null, 2)}\n`, 'utf8');
  return dir;
}

function prove(cwd: string, ...args: string[]) {
  expect(existsSync(proveFile), 'prove not built: run npm run build -w @kit/solver').toBe(true);
  const r = spawnSync(process.execPath, [proveFile, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Every file under proofs/ as a map from relative path to bytes (as text). */
function snapshot(cwd: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string, prefix: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name), `${prefix}${entry.name}/`);
      else out[`${prefix}${entry.name}`] = readFileSync(join(dir, entry.name), 'utf8');
    }
  };
  walk(join(cwd, 'proofs'), '');
  return out;
}

describe('prove command', () => {
  it('has been built', () => {
    expect(existsSync(proveFile), 'prove not built: run npm run build -w @kit/solver').toBe(true);
  });

  it('proves the two samples, repeats byte for byte, and checks clean', () => {
    const cwd = workFolder([fixture('sample-lights'), fixture('sample-hop')]);
    const first = prove(cwd);
    expect(first.code, first.stderr).toBe(0);
    const files = snapshot(cwd);
    expect(Object.keys(files).sort()).toEqual([
      'sample-hop/h1.json',
      'sample-hop/h2.json',
      'sample-hop/index.json',
      'sample-lights/index.json',
      'sample-lights/l1.json',
      'sample-lights/l2.json',
      'sample-lights/l3.json',
    ]);

    const h1 = JSON.parse(files['sample-hop/h1.json'] as string) as Record<string, unknown>;
    expect(h1).toMatchObject({
      checks: [],
      format: 1,
      game: 'sample-hop',
      kind: 'tick',
      level: 'h1',
      rulesVersion: '1',
      seed: 1,
      stats: { actions: 39, nodes: 151 },
      replay: { actions: ['none*9', 'hop', 'none*29'], finalPhase: 'won', format: 1, game: 'sample-hop', level: 'h1', rulesVersion: '1', seed: 1 },
    });
    expect((h1.replay as { finalHash: string }).finalHash).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.parse(files['sample-hop/index.json'] as string)).toEqual({
      game: 'sample-hop',
      levels: [{ actions: 39, id: 'h1' }, { actions: 39, id: 'h2' }],
    });
    const l3 = JSON.parse(files['sample-lights/l3.json'] as string) as { kind: string; replay: { actions: string[] }; stats: { actions: number } };
    expect(l3.kind).toBe('turn');
    expect(l3.replay.actions).toEqual(['press:1,0', 'press:0,1', 'press:2,2']);
    expect(l3.stats.actions).toBe(3);

    for (const text of Object.values(files)) {
      expect(text.endsWith('}\n')).toBe(true);
      expect(text).not.toContain('\r');
      expect(text).not.toMatch(/\d{4}-\d\d-\d\dT/);
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(Object.keys(parsed)).toEqual(Object.keys(parsed).sort());
      expect(text).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
    }

    const second = prove(cwd);
    expect(second.code, second.stderr).toBe(0);
    expect(snapshot(cwd)).toEqual(files);

    const check = prove(cwd, '--check');
    expect(check.code, check.stderr).toBe(0);
    expect(snapshot(cwd)).toEqual(files);
  }, 60000);

  it('exits 2 in --check mode when a proof differs, names the level and writes nothing', () => {
    const cwd = workFolder([fixture('sample-hop')]);
    expect(prove(cwd).code).toBe(0);
    const file = join(cwd, 'proofs', 'sample-hop', 'h1.json');
    writeFileSync(file, readFileSync(file, 'utf8').replace('"seed": 1,\n  "stats"', '"seed": 2,\n  "stats"'), 'utf8');
    const before = snapshot(cwd);
    const check = prove(cwd, '--check');
    expect(check.code).toBe(2);
    expect(check.stderr).toContain('sample-hop');
    expect(check.stderr).toContain('h1');
    expect(snapshot(cwd)).toEqual(before);
  }, 60000);

  it('exits 2 in --check mode when a proof file is missing', () => {
    const cwd = workFolder([fixture('sample-hop')]);
    const check = prove(cwd, '--check');
    expect(check.code).toBe(2);
    expect(check.stderr).toContain('h1');
    expect(snapshot(cwd)).toEqual({});
  }, 60000);

  it('exits 1 and leaves every proof file as it was when a level cannot be finished', () => {
    const cwd = workFolder([fixture('sample-lights'), fixture('sample-hop')]);
    expect(prove(cwd).code).toBe(0);
    const file = join(cwd, 'proofs', 'sample-hop', 'h1.json');
    writeFileSync(file, readFileSync(file, 'utf8').replace('"seed": 1,\n  "stats"', '"seed": 2,\n  "stats"'), 'utf8');
    const before = snapshot(cwd);

    writeFileSync(
      join(cwd, 'kit.config.json'),
      `${JSON.stringify({ games: [fixture('sample-lights'), fixture('sample-hop'), fixture('no-hop')] })}\n`,
      'utf8',
    );
    const failed = prove(cwd);
    expect(failed.code).toBe(1);
    expect(failed.stderr).toContain('no-hop');
    expect(failed.stderr).toContain('h1');
    expect(failed.stderr).toContain('exhausted');
    expect(snapshot(cwd)).toEqual(before);
    expect(prove(cwd, '--check').code).toBe(1);
  }, 60000);

  it('writes firstMoves for turn levels and the index, none for tick levels, and repeats byte for byte', () => {
    const cwd = workFolder([fixture('sample-lights'), fixture('sample-hop')]);
    const first = prove(cwd);
    expect(first.code, first.stderr).toBe(0);
    const files = snapshot(cwd);
    for (const level of ['l1', 'l2', 'l3']) {
      const proof = JSON.parse(files[`sample-lights/${level}.json`] as string) as { stats: Record<string, unknown> };
      expect(Object.keys(proof.stats)).toEqual(['actions', 'firstMoves', 'nodes']);
      expect(proof.stats.firstMoves).toMatchObject({ legal: 9 });
      const winning = (proof.stats.firstMoves as { winning: number }).winning;
      expect(winning).toBeGreaterThanOrEqual(1);
      expect(winning).toBeLessThanOrEqual(9);
    }
    const lightsIndex = JSON.parse(files['sample-lights/index.json'] as string) as { levels: { id: string; firstMoves: { legal: number; winning: number } }[] };
    expect(lightsIndex.levels.map((item) => item.id)).toEqual(['l1', 'l2', 'l3']);
    for (const item of lightsIndex.levels) {
      const proof = JSON.parse(files[`sample-lights/${item.id}.json`] as string) as { stats: { firstMoves: unknown } };
      expect(item.firstMoves).toEqual(proof.stats.firstMoves);
      expect(item.firstMoves.legal).toBe(9);
    }
    for (const level of ['h1', 'h2']) {
      const proof = JSON.parse(files[`sample-hop/${level}.json`] as string) as { stats: Record<string, unknown> };
      expect(proof.stats).not.toHaveProperty('firstMoves');
    }
    const hopIndex = JSON.parse(files['sample-hop/index.json'] as string) as { levels: Record<string, unknown>[] };
    for (const item of hopIndex.levels) expect(item).not.toHaveProperty('firstMoves');

    expect(prove(cwd).code).toBe(0);
    expect(snapshot(cwd)).toEqual(files);
    expect(prove(cwd, '--check').code).toBe(0);
  }, 60000);

  it('exits 2 in --check mode for proofs that have no firstMoves', () => {
    const cwd = workFolder([fixture('sample-lights')]);
    expect(prove(cwd).code).toBe(0);
    const file = join(cwd, 'proofs', 'sample-lights', 'l1.json');
    const text = readFileSync(file, 'utf8');
    writeFileSync(file, text.replace(/ {4}"firstMoves": \{[^}]*\},\n/, ''), 'utf8');
    expect(readFileSync(file, 'utf8')).not.toContain('firstMoves');
    const check = prove(cwd, '--check');
    expect(check.code).toBe(2);
    expect(check.stderr).toContain('l1');
  }, 60000);
  it('exits 3 for a missing config, a bad config and a game folder with no build', () => {
    expect(prove(workFolder(null)).code).toBe(3);

    const bad = workFolder(null);
    writeFileSync(join(bad, 'kit.config.json'), '{ not json', 'utf8');
    expect(prove(bad).code).toBe(3);

    const wrongShape = workFolder(null);
    writeFileSync(join(wrongShape, 'kit.config.json'), '{"games": "x"}\n', 'utf8');
    expect(prove(wrongShape).code).toBe(3);

    const noBuild = workFolder([join(tmpdir(), 'kit-prove-no-such-folder')]);
    const result = prove(noBuild);
    expect(result.code).toBe(3);
    expect(result.stderr.length).toBeGreaterThan(0);
  }, 60000);

  describe('level checks from dist/proof.js', () => {
    function gameWithProof(proofText: string): string {
      const dir = mkdtempSync(join(tmpdir(), 'kit-prove-game-'));
      temporary.push(dir);
      mkdirSync(join(dir, 'dist'));
      copyFileSync(join(fixture('sample-lights'), 'dist', 'def.js'), join(dir, 'dist', 'def.js'));
      writeFileSync(join(dir, 'dist', 'proof.js'), proofText, 'utf8');
      return dir;
    }

    it('writes the checks into the proof file when they pass', () => {
      const game = gameWithProof(
        [
          'export function levelChecks(def, levelId, result, tools) {',
          "  return [{ name: 'length_in_band', passed: result.actions.length >= 1, detail: `shortest solution has ${result.actions.length} actions, tools ${typeof tools.solveTurn}` }];",
          '}',
          '',
        ].join('\n'),
      );
      const cwd = workFolder([game]);
      const run = prove(cwd);
      expect(run.code, run.stderr).toBe(0);
      const l2 = JSON.parse(readFileSync(join(cwd, 'proofs', 'sample-lights', 'l2.json'), 'utf8')) as { checks: unknown[] };
      expect(l2.checks).toEqual([{ detail: 'shortest solution has 2 actions, tools function', name: 'length_in_band', passed: true }]);
    }, 60000);

    it('exits 1 and writes nothing when a check fails', () => {
      const game = gameWithProof(
        "export function levelChecks(def, levelId) { return [{ name: 'band', passed: levelId !== 'l3', detail: 'too short' }]; }\n",
      );
      const cwd = workFolder([game]);
      const run = prove(cwd);
      expect(run.code).toBe(1);
      expect(run.stderr).toContain('l3');
      expect(run.stderr).toContain('band');
      expect(snapshot(cwd)).toEqual({});
    }, 60000);

    it('exits 1 and leaves the files as they were when a first move search hits node_limit', () => {
      // With this key and 200 nodes, solveTurn solves every level but the search for some first move of l3 runs out of nodes.
      const game = gameWithProof("export const turnOptions = { maxNodes: 200, key: (state) => state.lamps };\n");
      const cwd = workFolder([fixture('sample-lights')]);
      expect(prove(cwd).code).toBe(0);
      const before = snapshot(cwd);
      writeFileSync(join(cwd, 'kit.config.json'), `${JSON.stringify({ games: [game] })}\n`, 'utf8');
      const run = prove(cwd);
      expect(run.code).toBe(1);
      expect(run.stderr).toContain('sample-lights');
      expect(run.stderr).toContain('l3');
      expect(run.stderr).toContain('first move press:');
      expect(run.stderr).toContain('hit node_limit');
      expect(snapshot(cwd)).toEqual(before);
    }, 60000);

    it('writes firstMoves from the same turnOptions that solveTurn gets', () => {
      const game = gameWithProof("export const turnOptions = { allow: (text) => text !== 'press:0,2' };\n");
      const cwd = workFolder([game]);
      const run = prove(cwd);
      expect(run.code, run.stderr).toBe(0);
      const l1 = JSON.parse(readFileSync(join(cwd, 'proofs', 'sample-lights', 'l1.json'), 'utf8')) as { stats: { firstMoves: { legal: number } } };
      expect(l1.stats.firstMoves.legal).toBe(8);
    }, 60000);
    it('passes turnOptions to the search', () => {
      const game = gameWithProof('export const turnOptions = { allow: () => false };\n');
      const cwd = workFolder([game]);
      const run = prove(cwd);
      expect(run.code).toBe(1);
      expect(run.stderr).toContain('exhausted');
      expect(snapshot(cwd)).toEqual({});
    }, 60000);
  });
});
