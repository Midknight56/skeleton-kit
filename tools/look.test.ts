import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { gardenTheme } from '../apps/garden/theme';
import { runnerTheme } from '../apps/runner/theme';
import { WATCH_LEFT_MESSAGE, WATCH_MESSAGE, TOKENS, checkTheme, watchLeftMessage } from '../kit/shell/src/index';
import { TOOLS, buildCalls, isWatchLeft, readLevel, readProgress, runningIndex } from '../site/calls';
import { LANDING_LEFT_MESSAGE, LANDING_MESSAGE } from '../site/landing-message';

const root = fileURLToPath(new URL('..', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe('the theme palettes', () => {
  const tokens = new Set<string>(Object.values(TOKENS));

  for (const [name, theme] of [['garden', gardenTheme], ['runner', runnerTheme]] as const) {
    it(`of the ${name} take every colour from the tokens`, () => {
      for (const [key, value] of Object.entries(theme.palette)) {
        expect(tokens.has(value.toLowerCase()), `${name} palette.${key} ${value}`).toBe(true);
      }
    });

    it(`of the ${name} pass checkTheme, with its title art and garland`, () => {
      expect(checkTheme(theme)).toEqual([]);
      expect(theme.titleArt, 'title art').toBeDefined();
    });
  }

  it('sets the glow of each sky from a token colour', () => {
    for (const theme of [gardenTheme, runnerTheme]) {
      expect(theme.glow, 'glow').toBeDefined();
      expect(tokens.has((theme.glow ?? '').slice(0, 7).toLowerCase())).toBe(true);
    }
  });
});

// Each phrase is built from two parts, so that this file does not hold the phrases it searches for.
const BANNED = [['Mario', 'nette'], ['program', '.py'], ['six', ' calls'], ['sample', ' game'], ['BEST', ' RUN']].map((parts) => new RegExp(parts.join(''), 'i'));

describe('words of the look', () => {
  it('names no tool, product or claim that is not in this repository', () => {
    const folders = ['site', 'kit/shell', 'apps/garden/src', 'apps/runner/src'];
    const files = [
      ...folders.flatMap((f) => walk(join(root, f))),
      join(root, 'apps/garden/theme.ts'),
      join(root, 'apps/runner/theme.ts'),
    ].filter((f) => /\.(ts|html|css|svg)$/.test(f) && !/\.test\.ts$/.test(f));
    expect(files.length).toBeGreaterThan(20);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of BANNED) if (pattern.test(text)) hits.push(`${relative(root, file)}: ${pattern.source}`);
    }
    expect(hits).toEqual([]);
  });
});

describe('the landing calls', () => {
  const proof = {
    level: 'g03',
    seed: 1,
    replay: { actions: ['light:2', 'wait*2', 'light:1'], finalHash: '9a074fd5e9266b9a', finalPhase: 'won' },
  };

  it('holds only the five tools of the tool door', () => {
    expect([...TOOLS]).toEqual(['new_game', 'act', 'observe', 'render', 'replay']);
    for (const call of buildCalls(proof)) expect(TOOLS as readonly string[]).toContain(call.name);
  });

  it('lists new_game, act and replay with the real inputs of the proof file', () => {
    const calls = buildCalls(proof);
    expect(calls.map((c) => c.name)).toEqual(['new_game', 'act', 'replay']);
    expect(calls[0]?.input).toEqual({ level: 'g03', seed: 1 });
    expect(calls[1]?.input).toEqual({ session: 's1', actions: ['light:2', 'wait', 'wait', 'light:1'] });
    expect(calls[2]?.input).toEqual({ session: 's1' });
  });

  it('shows a response only when the proof file holds it', () => {
    const calls = buildCalls(proof);
    expect(calls[0]?.response).toBeUndefined();
    expect(calls[1]?.response).toBe('applied 4, phase "won", hash 9a074fd5e9266b9a');
    expect(calls[2]?.response).toBe('finalPhase "won", finalHash 9a074fd5e9266b9a');
    const bare = buildCalls({ ...proof, replay: { actions: proof.replay.actions } });
    expect(bare.map((c) => c.response)).toEqual([undefined, undefined, undefined]);
  });

  it('runs the call that matches the run: new_game at the start, act while it plays, replay at the end', () => {
    expect(runningIndex(0, 4)).toBe(0);
    expect(runningIndex(1, 4)).toBe(1);
    expect(runningIndex(3, 4)).toBe(1);
    expect(runningIndex(4, 4)).toBe(2);
  });

  it('reads the message of the watch screen and nothing else', () => {
    const good = { type: WATCH_MESSAGE, level: 'g03', applied: 2, total: 4, round: 1 };
    expect(readProgress(good)).toEqual({ applied: 2, total: 4, round: 1 });
    expect(readProgress({ ...good, type: 'other' })).toBeNull();
    expect(readProgress({ ...good, applied: -1 })).toBeNull();
    expect(readProgress({ ...good, applied: 5 })).toBeNull();
    expect(readProgress({ ...good, total: 0 })).toBeNull();
    expect(readProgress('text')).toBeNull();
    expect(readProgress(null)).toBeNull();
  });

  it('uses the same message name as the watch screen', () => {
    expect(LANDING_MESSAGE).toBe(WATCH_MESSAGE);
  });

  it('reads the message that says the frame left the watch screen, and nothing else', () => {
    expect(isWatchLeft({ type: LANDING_LEFT_MESSAGE })).toBe(true);
    expect(isWatchLeft({ type: WATCH_MESSAGE })).toBe(false);
    expect(isWatchLeft(null)).toBe(false);
    expect(isWatchLeft('skeleton-kit:watch-left')).toBe(false);
  });

  it('reads the level of a watch message', () => {
    expect(readLevel({ type: WATCH_MESSAGE, level: 'g03', applied: 2, total: 4, round: 1 })).toBe('g03');
    expect(readLevel({ type: 'other', level: 'g03' })).toBeNull();
    expect(readLevel({ type: WATCH_MESSAGE, level: 3 })).toBeNull();
  });

  it('uses the same left message name as the watch screen', () => {
    expect(LANDING_LEFT_MESSAGE).toBe(WATCH_LEFT_MESSAGE);
    expect(watchLeftMessage()).toEqual({ type: WATCH_LEFT_MESSAGE });
  });});

describe('the credits', () => {
  for (const game of ['garden', 'runner']) {
    it(`of the ${game} name both fonts and their licence`, () => {
      const text = readFileSync(join(root, `apps/${game}/src/main.ts`), 'utf8');
      expect(text).toContain('Bricolage Grotesque');
      expect(text).toContain('Sometype Mono');
      expect(text.match(/SIL Open Font License 1\.1/g)?.length).toBeGreaterThanOrEqual(2);
    });
  }
});
