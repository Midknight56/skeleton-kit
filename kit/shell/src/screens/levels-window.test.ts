// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { levelsScreen } from './levels';

// Each open tick card shows the tightest jump of its proof, as steps and milliseconds.

const levels = [{ id: 'r1', title: 'One' }, { id: 'r2', title: 'Two' }];
const facts = (id: string) => ({ r1: { actions: 687, window: 9 }, r2: { actions: 920, window: 10 } })[id as 'r1'];
const build = (kind: 'turn' | 'tick', done: string[]) =>
  levelsScreen(document, { levels, stars: (id) => (done.includes(id) ? 3 : 0), onPick() {}, onBack() {}, facts, kind });
const tile = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>('[data-control="level-' + id + '"]')!;

describe('the tightest jump on a runner card', () => {
  it('shows steps and milliseconds on an open card', () => {
    const t = tile(build('tick', []), 'r1');
    expect(t.querySelector('[data-window]')?.textContent).toBe('9 steps150 ms');
    expect(t.querySelector('[data-window]')?.getAttribute('aria-hidden')).toBe('true');
    expect(t.dataset.windowTicks).toBe('9');
    expect(tile(build('tick', ['r1']), 'r2').querySelector('[data-window]')?.textContent).toBe('10 steps167 ms');
  });

  it('puts the same numbers in the accessible name', () => {
    expect(tile(build('tick', []), 'r1').getAttribute('aria-label')).toBe('One, 0 of 3 stars, wins in 687 ticks, tightest jump 9 steps, about 150 ms');
  });

  it('shows nothing on a locked card', () => {
    const t = tile(build('tick', []), 'r2');
    expect(t.querySelector('[data-window]')).toBeNull();
    expect(t.getAttribute('aria-label')).toBe('Two, locked');
  });

  it('shows nothing on a turn game card', () => {
    expect(tile(build('turn', []), 'r1').querySelector('[data-window]')).toBeNull();
  });
});