// The proven facts of a level, as pips and a text. Pure: it reads no page and no clock.
// The numbers come from the proof. The text states facts of the proof and gives no opinion.
export interface LevelFacts {
  actions: number;
  firstMoves?: { legal: number; winning: number };
}
export interface Difficulty {
  filled: number;
  total: number;
  text: string;
}

const MAX_PIPS = 8;

export function describeFacts(facts: LevelFacts, kind: 'turn' | 'tick' = 'turn'): Difficulty {
  const first = facts.firstMoves;
  if (!first) {
    const unit = kind === 'tick' ? ' ticks' : '';
    return { filled: 0, total: 0, text: `wins in ${facts.actions}${unit}` };
  }
  const { legal, winning } = first;
  const total = Math.min(legal, MAX_PIPS);
  let filled = winning;
  if (legal > MAX_PIPS) {
    filled = Math.round((winning * MAX_PIPS) / legal);
    if (winning >= 1 && filled < 1) filled = 1;
    if (winning < legal && filled > MAX_PIPS - 1) filled = MAX_PIPS - 1;
  }
  const ending = legal === 1 ? 'first move wins' : 'first moves win';
  return { filled, total, text: `wins in ${facts.actions}, ${winning} of ${legal} ${ending}` };
}
