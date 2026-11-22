// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { howScreen } from './how';

const lessons = [
  { id: 'a', anchor: 'x', text: 'Tap here' },
  { id: 'b', anchor: 'y', text: 'Then wait' },
];
const items = (root: HTMLElement): (string | null)[] => Array.from(root.querySelectorAll('li')).map((li) => li.textContent);

describe('how to play screen with whole sentences', () => {
  it('lists the sentences of the game and not the short chips or the key lines', () => {
    const howTo = ['Tap a thing to start it.', 'The thing moves by itself.'];
    const root = howScreen(document, { lessons, keys: ['Space: wait'], howTo, onBack: () => undefined });
    expect(items(root)).toEqual(howTo);
  });

  it('lists the chips and the key lines when the game gives no sentences', () => {
    const root = howScreen(document, { lessons, keys: ['Space: wait'], onBack: () => undefined });
    expect(items(root)).toEqual(['Tap here', 'Then wait', 'Space: wait']);
  });

  it('keeps the Back button', () => {
    const root = howScreen(document, { lessons, keys: [], howTo: ['One sentence.'], onBack: () => undefined });
    expect(root.querySelector('[data-control="back"]')).not.toBeNull();
  });
});
