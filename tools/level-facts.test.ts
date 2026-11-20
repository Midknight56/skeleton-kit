import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { levelFactsPlugin, readLevelFacts } from './level-facts.mjs';

const made: string[] = [];

// A temporary repository root with one proof index. The real proofs/ folder is never touched.
function tree(game: string, index: string | null): string {
  const root = mkdtempSync(join(tmpdir(), 'facts-'));
  made.push(root);
  if (index !== null) {
    mkdirSync(join(root, 'proofs', game), { recursive: true });
    writeFileSync(join(root, 'proofs', game, 'index.json'), index, 'utf8');
  }
  return root;
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const turnIndex = JSON.stringify({
  game: 'one',
  levels: [
    { id: 'a1', actions: 4, firstMoves: { legal: 5, winning: 2 } },
    { id: 'a2', actions: 3 },
  ],
});

describe('readLevelFacts', () => {
  it('copies actions and firstMoves of a turn index', () => {
    const facts = readLevelFacts(tree('one', turnIndex), 'one');
    expect(facts.game).toBe('one');
    expect(facts.levels.a1).toEqual({ actions: 4, firstMoves: { legal: 5, winning: 2 } });
  });

  it('gives actions only for a tick index', () => {
    const root = tree('two', JSON.stringify({ game: 'two', levels: [{ id: 'r1', actions: 687 }] }));
    const facts = readLevelFacts(root, 'two');
    expect(facts.levels.r1).toEqual({ actions: 687 });
    expect('firstMoves' in (facts.levels.r1 as object)).toBe(false);
  });

  it('throws and names the file when the index is missing', () => {
    expect(() => readLevelFacts(tree('one', null), 'one')).toThrow(/proofs\/one\/index\.json.*npm run prove/);
  });

  it('throws and names the file when the JSON is broken', () => {
    expect(() => readLevelFacts(tree('one', '{ nope'), 'one')).toThrow(/proofs\/one\/index\.json.*npm run prove/);
  });

  it('throws when levels is not a list', () => {
    expect(() => readLevelFacts(tree('one', '{"game":"one"}'), 'one')).toThrow(/proofs\/one\/index\.json.*npm run prove/);
  });

  it.each([['"4"'], ['4.5'], ['-1'], ['null']])('throws when actions is %s', (value) => {
    const index = `{"game":"one","levels":[{"id":"a1","actions":${value}}]}`;
    expect(() => readLevelFacts(tree('one', index), 'one')).toThrow(/proofs\/one\/index\.json.*npm run prove/);
  });

  it('throws when an item has no actions', () => {
    const index = '{"game":"one","levels":[{"id":"a1"}]}';
    expect(() => readLevelFacts(tree('one', index), 'one')).toThrow(/proofs\/one\/index\.json.*npm run prove/);
  });
});

describe('levelFactsPlugin', () => {
  function run(root: string, pageRoot: string, html: string): string {
    const plugin = levelFactsPlugin(root) as unknown as {
      configResolved(config: { root: string }): void;
      transformIndexHtml(html: string): string;
    };
    plugin.configResolved({ root: pageRoot });
    return plugin.transformIndexHtml(html);
  }
  const page = '<html><head><title>x</title></head><body></body></html>';

  it('adds the tag to the head of a page under apps/', () => {
    const root = tree('one', turnIndex);
    const out = run(root, join(root, 'apps', 'one'), page);
    const match = /<script type="application\/json" id="kit-level-facts">(.*?)<\/script>/.exec(out);
    expect(match).not.toBeNull();
    expect(JSON.parse(match?.[1] ?? '')).toEqual({
      game: 'one',
      levels: { a1: { actions: 4, firstMoves: { legal: 5, winning: 2 } }, a2: { actions: 3 } },
    });
    expect(out.indexOf('kit-level-facts')).toBeLessThan(out.indexOf('</head>'));
  });

  it('writes < as \\u003c', () => {
    const index = JSON.stringify({ game: 'one', levels: [{ id: 'a</script>', actions: 2 }] });
    const root = tree('one', index);
    const out = run(root, join(root, 'apps', 'one'), page);
    expect(out).toContain('a\\u003c/script>');
    expect(out.match(/<\/script>/g)).toHaveLength(1);
  });

  it('adds nothing to a page outside apps/', () => {
    const root = tree('one', turnIndex);
    expect(run(root, join(root, 'site'), page)).toBe(page);
  });

  it('fails the build for a missing index', () => {
    const root = tree('one', null);
    expect(() => run(root, join(root, 'apps', 'one'), page)).toThrow(/proofs\/one\/index\.json.*npm run prove/);
  });
});
