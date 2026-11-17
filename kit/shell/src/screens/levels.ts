import type { LevelRef } from '@kit/core';
import { button, heading, screenRoot, stars } from './dom';

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
}

export function levelsScreen(doc: Document, props: LevelsProps): HTMLElement {
  const root = screenRoot(doc, 'levels');
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
    tile.setAttribute('aria-label', `${level.title}, ${locked ? 'locked' : `${earned} of 3 stars`}`);
    const name = doc.createElement('span');
    name.textContent = locked ? `${i + 1} 🔒` : String(i + 1);
    tile.append(name, doc.createElement('br'), stars(doc, earned));
    grid.append(tile);
  });
  root.append(grid, button(doc, 'back', 'Back', props.onBack));
  return root;
}
