import type { LevelRef } from '@kit/core';
import { describeFacts, describeWindow, type LevelFacts } from '../difficulty';
import { button, heading, menuColumn, menuRoot, paragraph, stars } from './dom';

// A level is locked when an earlier level is not finished. The first unfinished level is open.
export function levelLocks(levels: LevelRef[], isFinished: (id: string) => boolean): boolean[] {
  let locked = false;
  return levels.map((level) => {
    const result = locked;
    if (!isFinished(level.id)) locked = true;
    return result;
  });
}

export interface LevelsProps {
  levels: LevelRef[];
  stars(levelId: string): number;
  onPick(levelId: string): void;
  onBack(): void;
  // The proven facts of a level, if the page has them.
  facts?(levelId: string): LevelFacts | undefined;
  kind?: 'turn' | 'tick';
}

export function levelsScreen(doc: Document, props: LevelsProps): HTMLElement {
  const root = menuRoot(doc, 'levels');
  root.append(heading(doc, 'Levels'));
  const grid = doc.createElement('div');
  grid.className = 'tiles';
  const locks = levelLocks(props.levels, (id) => props.stars(id) >= 1);
  props.levels.forEach((level, i) => {
    const locked = locks[i] === true;
    const earned = props.stars(level.id);
    const tile = button(doc, `level-${level.id}`, '', () => {
      if (!locked) props.onPick(level.id);
    });
    tile.dataset.locked = String(locked);
    tile.dataset.stars = String(earned);
    if (locked) tile.setAttribute('aria-disabled', 'true');
    const facts = locked ? undefined : props.facts?.(level.id);
    const described = facts ? describeFacts(facts, props.kind) : undefined;
    const base = `${level.title}, ${locked ? 'locked' : `${earned} of 3 stars`}`;
    tile.setAttribute('aria-label', described ? `${base}, ${described.text}` : base);
    if (facts) {
      tile.dataset.actions = String(facts.actions);
      if (props.kind === 'tick' && facts.window !== undefined) tile.dataset.windowTicks = String(facts.window);
      if (facts.firstMoves) {
        tile.dataset.firstLegal = String(facts.firstMoves.legal);
        tile.dataset.firstWin = String(facts.firstMoves.winning);
      }
    }
    const name = doc.createElement('span');
    name.textContent = locked ? `${i + 1} 🔒` : String(i + 1);
    tile.append(name, doc.createElement('br'), stars(doc, earned));
    if (described && described.total > 0) {
      const row = doc.createElement('span');
      row.dataset.pips = '';
      row.setAttribute('aria-hidden', 'true');
      for (let n = 0; n < described.total; n++) {
        const pip = doc.createElement('i');
        if (n < described.filled) pip.dataset.on = '';
        row.append(pip);
      }
      tile.append(row);
    }
    // A turn level says the fewest moves that win. The spoken name of the card already says it.
    if (facts && props.kind === 'turn') {
      const moves = doc.createElement('span');
      moves.dataset.moves = '';
      moves.setAttribute('aria-hidden', 'true');
      moves.textContent = `${facts.actions} ${facts.actions === 1 ? 'move' : 'moves'}`;
      tile.append(moves);
    }
    // A tick course says its tightest jump. The spoken name of the card already says it.
    if (facts && props.kind === 'tick' && facts.window !== undefined) {
      const tight = describeWindow(facts.window);
      const box = doc.createElement('span');
      box.dataset.window = '';
      box.setAttribute('aria-hidden', 'true');
      const steps = doc.createElement('span');
      steps.textContent = tight.steps;
      const time = doc.createElement('span');
      time.textContent = tight.time;
      box.append(steps, time);
      tile.append(box);
    }
    grid.append(tile);
  });
  root.append(grid);
  // A locked tile shows only a lock, so one line says how to open it.
  if (locks.some((locked) => locked)) {
    const note = paragraph(doc, 'Win a level to open the next one.');
    note.dataset.locks = '';
    root.append(note);
  }
  root.append(menuColumn(doc, button(doc, 'back', 'Back', props.onBack)));
  return root;
}
