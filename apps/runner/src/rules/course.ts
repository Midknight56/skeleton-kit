import { initState, type RawCourse, type RunnerState } from './state';

const MIN_COLUMNS = 40;
const MAX_COLUMNS = 200;
const PLAIN_COLUMNS = 6;
const MAX_GAP = 2;

const GROUND_CHARS = '_.pPG';
const AIR_CHARS = '.c';

/** Reads a course. It returns a list of problems and never throws. A problem that has a column names it, from 1. */
export function parseCourse(raw: RawCourse): { ok: true; state: RunnerState } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const { ground, air1, air2 } = raw;

  if (ground.length < MIN_COLUMNS || ground.length > MAX_COLUMNS) {
    problems.push(`The course has ${ground.length} columns. It needs ${MIN_COLUMNS} to ${MAX_COLUMNS}.`);
  }
  if (air1.length !== ground.length || air2.length !== ground.length) {
    problems.push(`The rows have different lengths: air2 ${air2.length}, air1 ${air1.length}, ground ${ground.length}.`);
  }

  const rows: [string, string, string][] = [
    ['air2', air2, AIR_CHARS],
    ['air1', air1, AIR_CHARS],
    ['ground', ground, GROUND_CHARS],
  ];
  for (const [name, row, allowed] of rows) {
    for (let i = 0; i < row.length; i++) {
      const char = row.charAt(i);
      if (!allowed.includes(char)) problems.push(`Row ${name}, column ${i + 1}: "${char}" is not allowed.`);
    }
  }

  if (ground.length > 0 && !ground.includes('G')) problems.push('The ground row has no G.');
  for (let i = 0; i < ground.length - 1; i++) {
    if (ground.charAt(i) === 'G') problems.push(`Column ${i + 1}: the gate G may only be in the last column.`);
  }
  if (ground.length > 0 && ground.includes('G') && ground.charAt(ground.length - 1) !== 'G' && !problems.some((p) => p.includes('gate G may only'))) {
    problems.push(`Column ${ground.length}: the last column must be the gate G.`);
  }

  const length = Math.max(ground.length, air1.length, air2.length);
  for (let i = 0; i < Math.min(PLAIN_COLUMNS, length); i++) {
    const plain = ground.charAt(i) === '_' && air1.charAt(i) === '.' && air2.charAt(i) === '.';
    if (!plain) problems.push(`Column ${i + 1}: the first ${PLAIN_COLUMNS} columns must be plain ground and empty air.`);
  }

  for (let i = 0; i < ground.length; ) {
    if (ground.charAt(i) !== '.') {
      i++;
      continue;
    }
    let end = i;
    while (end < ground.length && ground.charAt(end) === '.') end++;
    if (end - i > MAX_GAP) problems.push(`Column ${i + 1}: a gap of ${end - i} columns is longer than ${MAX_GAP}.`);
    i = end;
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, state: initState(raw) };
}
