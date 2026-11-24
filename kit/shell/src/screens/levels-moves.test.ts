// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { levelsScreen } from './levels';

// Each open turn level card shows the fewest moves that win, as a short label.

const levels = [{ id: 'a1', title: 'One' }, { id: 'a2', title: 'Two' }, { id: 'a3', title: 'Three' }];
const facts = (id: string) => ({ a1: { actions: 3, firstMoves: { legal: 4, winning: 1 } }, a2: { actions: 1, firstMoves: { legal: 2, winning: 1 } }, a3: { actions: 5, firstMoves: { legal: 2, winning: 2 } } })[id as 'a1'];
const build = (kind: 'turn' | 'tick', done: string[]) =>
  levelsScreen(document, { levels, stars: (id) => (done.includes(id) ? 3 : 0), onPick() {}, onBack() {}, facts, kind });
const label = (root: HTMLElement, id: string): string | null => root.querySelector(`[data-control="level-${id}"] [data-moves]`)?.textContent ?? null;

describe('the fewest moves on a level card', () => {
  it('shows the number of moves on an open turn level and says one move in the singular', () => {
    const root = build('turn', []);
    expect(label(root, 'a1')).toBe('3 moves');
    expect(root.querySelector('[data-control="level-a1"] [data-moves]')?.getAttribute('aria-hidden')).toBe('true');
    const second = build('turn', ['a1']);
    expect(label(second, 'a2')).toBe('1 move');
  });

  it('shows nothing on a locked level', () => {
    const root = build('turn', []);
    expect(label(root, 'a2')).toBeNull();
    expect(label(root, 'a3')).toBeNull();
  });

  it('shows nothing on a tick game card', () => {
    const root = build('tick', []);
    expect(label(root, 'a1')).toBeNull();
  });

  it('keeps the spoken name and the data of the card', () => {
    const tile = build('turn', []).querySelector<HTMLElement>('[data-control="level-a1"]')!;
    expect(tile.getAttribute('aria-label')).toContain('wins in 3');
    expect(tile.dataset.actions).toBe('3');
  });
});