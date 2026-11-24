import type { LevelFacts } from './difficulty';

const whole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function parseItem(item: unknown): LevelFacts | null {
  if (item === null || typeof item !== 'object') return null;
  const { actions, firstMoves, window } = item as { actions?: unknown; firstMoves?: unknown; window?: unknown };
  if (!whole(actions)) return null;
  const tight = whole(window) ? { window } : {};
  if (firstMoves === undefined) return { actions, ...tight };
  if (firstMoves === null || typeof firstMoves !== 'object') return null;
  const { legal, winning } = firstMoves as { legal?: unknown; winning?: unknown };
  if (!whole(legal) || !whole(winning) || winning > legal) return null;
  return { actions, firstMoves: { legal, winning }, ...tight };
}

// The build puts the numbers of the proof into the page as one JSON tag. This reads it once.
// A missing or damaged tag gives an empty map, and the screens work as before.
export function readLevelFacts(doc: Document): Map<string, LevelFacts> {
  const facts = new Map<string, LevelFacts>();
  const text = doc.getElementById('kit-level-facts')?.textContent;
  if (!text) return facts;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return facts;
  }
  const levels = data !== null && typeof data === 'object' ? (data as { levels?: unknown }).levels : undefined;
  if (levels === null || typeof levels !== 'object' || Array.isArray(levels)) return facts;
  for (const [id, item] of Object.entries(levels)) {
    const parsed = parseItem(item);
    if (parsed) facts.set(id, parsed);
  }
  return facts;
}
