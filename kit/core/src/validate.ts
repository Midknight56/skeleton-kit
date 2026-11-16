import type { GameDef, Json } from './types';

const FUNCTION_MEMBERS = ['init', 'actions', 'step', 'status', 'observe', 'view', 'encodeAction', 'decodeAction'] as const;

function checkLevels(def: Record<string, unknown>, problems: string[]): void {
  if (typeof def.levels !== 'function') {
    problems.push('levels: must be a function');
    return;
  }
  let list: unknown;
  try {
    list = (def.levels as () => unknown)();
  } catch (error) {
    problems.push(`levels: the call threw (${error instanceof Error ? error.message : String(error)})`);
    return;
  }
  if (!Array.isArray(list) || list.length === 0) {
    problems.push('levels: must return a list with at least one level');
    return;
  }
  const seen = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const level = list[i] as { id?: unknown } | null;
    const id = level !== null && typeof level === 'object' ? level.id : undefined;
    if (typeof id !== 'string' || id === '') {
      problems.push(`levels: item ${i} has no id`);
    } else if (seen.has(id)) {
      problems.push(`levels: the id "${id}" is used more than once`);
    } else {
      seen.add(id);
    }
  }
}

/** Reports problems in a game definition as a list of text lines. Each line starts with the failing member. It never throws. */
export function validateDef(def: GameDef<Json, unknown>): string[] {
  if (def === null || typeof def !== 'object') return ['definition: must be an object'];
  const record = def as unknown as Record<string, unknown>;
  const problems: string[] = [];

  if (typeof record.id !== 'string' || !/^[a-z0-9-]+$/.test(record.id)) {
    problems.push('id: must be one or more lower case letters, digits or "-"');
  }
  for (const name of ['title', 'rulesVersion']) {
    if (typeof record[name] !== 'string' || record[name] === '') problems.push(`${name}: must be a non-empty string`);
  }
  if (record.kind !== 'turn' && record.kind !== 'tick') {
    problems.push('kind: must be "turn" or "tick"');
  } else if (record.kind === 'tick') {
    const rate = record.ticksPerSecond;
    if (typeof rate !== 'number' || !Number.isInteger(rate) || rate < 1 || rate > 120) {
      problems.push('ticksPerSecond: a tick game needs an integer from 1 to 120');
    }
  }
  checkLevels(record, problems);
  for (const name of FUNCTION_MEMBERS) {
    if (typeof record[name] !== 'function') problems.push(`${name}: must be a function`);
  }
  return problems;
}
