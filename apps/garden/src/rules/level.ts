import { initState } from './state';
import type { GardenState } from './state';

export type RawLevel = { id: string; title: string; maxTurns: number; rows: string[] };

export type ParseResult = { ok: true; state: GardenState } | { ok: false; problems: string[] };

const ALLOWED = /^[.#wfm1-5]$/;

/** Reads a level from text rows. It returns a list of problems and never throws. Rows and columns count from 1. */
export function parseLevel(raw: RawLevel): ParseResult {
  const problems: string[] = [];
  const rows: unknown = raw?.rows;
  const maxTurns: unknown = raw?.maxTurns;

  if (typeof maxTurns !== 'number' || !Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 99) {
    problems.push('maxTurns must be an integer from 1 to 99.');
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    problems.push('The level has no rows.');
    return { ok: false, problems };
  }

  const lines = rows as unknown[];
  let moths = 0;
  let flowers = 0;
  const lanterns = new Set<string>();
  let width = -1;
  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    if (typeof line !== 'string') {
      problems.push(`Row ${y + 1} is not text.`);
      continue;
    }
    if (width === -1) width = line.length;
    if (line.length !== width) problems.push(`Row ${y + 1} has length ${line.length}, but row 1 has length ${width}.`);
    for (let x = 0; x < line.length; x++) {
      const ch = line.charAt(x);
      if (!ALLOWED.test(ch)) {
        problems.push(`Row ${y + 1}, column ${x + 1}: the character "${ch}" is not allowed.`);
      } else if (ch === 'm') {
        moths++;
      } else if (ch === 'f') {
        flowers++;
      } else if (ch >= '1' && ch <= '5') {
        if (lanterns.has(ch)) problems.push(`Row ${y + 1}, column ${x + 1}: lantern ${ch} is used more than once.`);
        lanterns.add(ch);
      }
    }
  }

  if (width > 9) problems.push(`The width is ${width}, and the most allowed is 9.`);
  if (lines.length > 7) problems.push(`The height is ${lines.length}, and the most allowed is 7.`);
  if (moths === 0) problems.push('The level has no moth.');
  if (moths > 4) problems.push(`The level has more than 4 moths (${moths}).`);
  if (lanterns.size === 0) problems.push('The level has no lantern.');
  if (flowers < moths) problems.push(`The level has fewer flowers (${flowers}) than moths (${moths}).`);

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, state: initState(raw) };
}
