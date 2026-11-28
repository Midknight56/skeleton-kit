import { describe, expect, it } from 'vitest';
import {
  EXAMPLE_ROWS,
  LIMITS,
  compare,
  exportFile,
  importFile,
  parseGridText,
  playRoute,
  routeFor,
  searchLevel,
  shippedLevel,
  type Level,
} from './level-compare';

// Spec level-edit-compare. The route always comes from the kit search on the shipped level.
const original = shippedLevel();
const seed = 1;
const route = routeFor(original, seed)!;
const edit = (rows: string[]): Level => ({ ...original, rows });

describe('level compare', () => {
  it('finds the route by search and it wins the shipped level', () => {
    expect(route.length).toBeGreaterThan(0);
    const frames = playRoute(original, seed, route);
    expect(frames[frames.length - 1]!.phase).toBe('won');
  });

  it('breaks: moving the flower changes the outcome of the old route on turn 2', () => {
    const result = compare(original, edit(EXAMPLE_ROWS), seed, route);
    expect(route).toEqual(['light:1', 'wait']);
    expect(result.changed).toBe(true);
    expect(result.difference!.turn).toBe(2);
    expect(result.difference!.action).toBe('wait');
    expect(result.original[2]!.phase).toBe('won');
    expect(result.edited[2]!.phase).toBe('playing');
    expect(result.difference!.text).toContain('On turn 2 (wait)');
    expect(result.difference!.text).toContain('the level is won');
    expect(result.difference!.text).toContain('stays in play');
    // Turn zero differs only by the board, and is not reported as a change.
    expect(result.difference!.turn).not.toBe(0);
    // The route sentence limits itself to these moves.
    expect(result.route).toContain('does not say whether another route wins');
  });

  it('reports what the bounded search says about the edited board, without a claim from the route', () => {
    const result = compare(original, edit(EXAMPLE_ROWS), seed, route);
    expect(['won', 'exhausted', 'inconclusive']).toContain(result.search.kind);
    const tiny = searchLevel(edit(EXAMPLE_ROWS), seed, 1);
    expect(tiny.kind).toBe('inconclusive');
    expect(tiny.text).toContain('Inconclusive');
    const same = searchLevel(original, seed);
    expect(same.kind).toBe('won');
  });

  it('preserves: no change and a harmless edit keep every outcome', () => {
    const none = compare(original, edit([...original.rows]), seed, route);
    expect(none.changed).toBe(false);
    expect(none.difference).toBeNull();
    expect(none.route).toContain('same outcome');
    const extra = compare(original, edit(['2f1..', 'm..#.', '.f.f.']), seed, route);
    expect(extra.changed).toBe(false);
  });

  it('repairs: restoring the shipped rows shows the old win holds', () => {
    const broken = compare(original, edit(EXAMPLE_ROWS), seed, route);
    expect(broken.changed).toBe(true);
    const restored = compare(original, edit([...original.rows]), seed, route);
    expect(restored.changed).toBe(false);
    expect(restored.edited[restored.edited.length - 1]!.phase).toBe('won');
    expect(restored.edited.map((f) => f.hash)).toEqual(restored.original.map((f) => f.hash));
  });

  it('says in text what is on every square', () => {
    const frames = playRoute(original, seed, route);
    expect(frames[0]!.squares[0]).toBe('Row 1: lantern 2, flower, lantern 1, empty, empty');
    expect(frames[0]!.squares[1]).toContain('empty with moth 1');
    expect(frames[2]!.text).toContain('home on the flower at row 1, column 2');
  });

  it('stops a refused move and says why', () => {
    const frames = playRoute(original, seed, ['wait', 'light:1']);
    expect(frames[1]!.played).toBe(false);
    expect(frames[1]!.text).toContain('not played');
    expect(frames[2]!.played).toBe(false);
  });
});

describe('level edit input', () => {
  it('names the row and column of a bad character', () => {
    const result = parseGridText('2f1..\nm..#x\n.f...', original);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toContain('Row 2, column 5');
  });

  it('rejects rows of different length, no flower, empty and too tall input', () => {
    expect(parseGridText('2f1..\nm..#\n.f...', original).ok).toBe(false);
    expect(parseGridText('21..\nm..#.\n.....', original).ok).toBe(false);
    expect(parseGridText('  \n', original).ok).toBe(false);
    const tall = parseGridText(Array(8).fill('2f1m.').join('\n'), original);
    expect(tall.ok).toBe(false);
  });

  it('caps the text size and the width', () => {
    const long = parseGridText('.'.repeat(LIMITS.maxGridChars + 1), original);
    expect(long.ok).toBe(false);
    const wide = parseGridText('2f1.......m', original);
    expect(wide.ok).toBe(false);
  });

  it('accepts CRLF and trailing blank lines', () => {
    const ok = parseGridText('2.1f.\r\nm..#.\r\n.f...\r\n\r\n', original);
    expect(ok.ok && ok.level.rows).toEqual(EXAMPLE_ROWS);
  });
});

describe('saved file', () => {
  const edited = edit(EXAMPLE_ROWS);
  it('exports inputs only and a fresh import reproduces the same comparison', () => {
    const text = exportFile(original, edited, seed, route);
    expect(text).not.toMatch(/phase|won|hash|difference/);
    const back = importFile(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const first = compare(original, edited, seed, route);
    const second = compare(back.file.original, back.file.edited, back.file.seed, back.file.actions);
    expect(second).toEqual(first);
    expect(exportFile(back.file.original, back.file.edited, back.file.seed, back.file.actions)).toBe(text);
  });

  it('ignores a claim added to the file and plays the moves again', () => {
    const forged = JSON.parse(exportFile(original, edited, seed, route)) as Record<string, unknown>;
    forged.result = 'won';
    forged.difference = null;
    const back = importFile(JSON.stringify(forged));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.file).not.toHaveProperty('result');
    expect(compare(back.file.original, back.file.edited, back.file.seed, back.file.actions).changed).toBe(true);
  });

  it('rejects bad files with a reason', () => {
    const good = JSON.parse(exportFile(original, edited, seed, route)) as Record<string, unknown>;
    const bad = (patch: Record<string, unknown>): string => {
      const result = importFile(JSON.stringify({ ...good, ...patch }));
      expect(result.ok).toBe(false);
      return result.ok ? '' : result.problems.join(' ');
    };
    expect(importFile('{nope').ok).toBe(false);
    expect(importFile('[]').ok).toBe(false);
    expect(bad({ version: 2 })).toContain('version');
    expect(bad({ format: 'x' })).toContain('format');
    expect(bad({ seed: -1 })).toContain('seed');
    expect(bad({ seed: 1.5 })).toContain('seed');
    expect(bad({ actions: Array(LIMITS.maxMoves + 1).fill('wait') })).toContain('actions');
    expect(bad({ actions: ['jump'] })).toContain('actions');
    expect(bad({ edited: { ...edited, rows: ['2f1..', 'm..#x', '.f...'] } })).toContain('edited');
    expect(bad({ original: { ...original, maxTurns: 100 } })).toContain('maxTurns');
    expect(bad({ edited: { ...edited, id: 'other' } })).toContain('same id');
  });

  it('caps the file size', () => {
    const big = JSON.stringify({ pad: 'x'.repeat(LIMITS.maxFileBytes) });
    const result = importFile(big);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toContain('bytes');
  });
});

describe('the saved route must win the original level', () => {
  const edited = edit(EXAMPLE_ROWS);
  const tryRoute = (actions: string[]): string => {
    const result = importFile(exportFile(original, edited, seed, actions));
    expect(result.ok).toBe(false);
    return result.ok ? '' : result.problems.join(' ');
  };

  it('accepts the legitimate winning route', () => {
    const result = importFile(exportFile(original, edited, seed, route));
    expect(result.ok).toBe(true);
  });

  it('rejects an empty route with a reason', () => {
    expect(tryRoute([])).toContain('no moves');
  });

  it('rejects a route that never wins', () => {
    const text = tryRoute(['light:1']);
    expect(text).toContain('does not win the original level');
    expect(text).toContain('still in play');
  });

  it('rejects a refused move and names it', () => {
    const text = tryRoute(['light:5', 'wait']);
    expect(text).toContain('Move 1 (light:5) is refused');
    expect(text).toContain('Fix or remove');
  });

  it('rejects moves past the win', () => {
    const text = tryRoute([...route, 'wait']);
    expect(text).toContain(`already won on move ${route.length}`);
    expect(text).toContain(`Remove move ${route.length + 1}`);
  });

  it('keeps different edited metadata through export and import', () => {
    const meta: Level = { ...edited, title: 'Short copy', maxTurns: 1 };
    const back = importFile(exportFile({ ...original, maxTurns: 6 }, meta, seed, route));
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.file.edited.title).toBe('Short copy');
      expect(back.file.edited.maxTurns).toBe(1);
      expect(back.file.original.title).toBe(original.title);
    }
  });
});
