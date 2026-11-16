import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const kitDir = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// The list from the kit-boundary rule. Each word is built from two parts so that
// this file does not contain the words it searches for.
const words = [
  ['mo', 'th'],
  ['lan', 'tern'],
  ['flo', 'wer'],
  ['w', 'eb'],
  ['bro', 'om'],
  ['pump', 'kin'],
  ['can', 'dle'],
  ['ga', 'te'],
].map((parts) => parts.join(''));

const pattern = new RegExp(`(?<![A-Za-z0-9])(?:${words.join('|')})(?![A-Za-z0-9])`, 'i');

export function findGameWord(text: string): string | undefined {
  return pattern.exec(text)?.[0];
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out.sort();
}

describe('game words', () => {
  it('finds a planted whole word in any letter case', () => {
    for (const word of words) {
      expect(findGameWord(`let a = "${word}";`)).toBe(word);
      expect(findGameWord(`// ${word.toUpperCase()} here`)).toBe(word.toUpperCase());
    }
    expect(findGameWord(`the ${words[7]}, then more`)).toBe(words[7]);
  });

  it('does not count a word inside a longer word', () => {
    const last = words[7]!;
    expect(findGameWord('navigate')).toBeUndefined();
    expect(findGameWord('Navigate the menu')).toBeUndefined();
    expect(findGameWord(`${last}way`)).toBeUndefined();
    expect(findGameWord(`aggregate`)).toBeUndefined();
  });

  it('finds no game word in any file under kit/', () => {
    const files = listFiles(kitDir);
    expect(files.length).toBeGreaterThan(20);
    const hits: string[] = [];
    for (const file of files) {
      const found = findGameWord(readFileSync(file, 'utf8'));
      if (found) hits.push(`${relative(kitDir, file)}: ${found}`);
    }
    expect(hits).toEqual([]);
  });
});
