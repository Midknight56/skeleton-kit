import { describe, expect, it } from 'vitest';
import def from './def';
import { gardenInput } from './input';

// The how to play screen of the garden puzzle is a list of whole sentences. The chips on the
// first level stay short (see input.test.ts); the screen does not repeat them as fragments.

const sentences = gardenInput.howTo ?? [];
const all = sentences.join(' ').toLowerCase();

describe('garden how to play', () => {
  it('has sentences', () => {
    expect(sentences.length).toBeGreaterThanOrEqual(6);
    expect(sentences.length).toBeLessThanOrEqual(10);
  });

  it('has only whole sentences: a capital letter, a full stop, at least four words, no colon', () => {
    for (const s of sentences) {
      expect(s, s).toMatch(/^[A-Z]/);
      expect(s, s).toMatch(/\.$/);
      expect(s.split(/\s+/).length, s).toBeGreaterThanOrEqual(4);
      expect(s, s).not.toContain(':');
    }
  });

  it('keeps each sentence short', () => {
    for (const s of sentences) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(16);
  });

  it('says what the lantern, the moth, the flower, the hedge and the web do', () => {
    for (const word of ['lantern', 'moth', 'flower', 'hedge', 'web']) expect(all, word).toContain(word);
    expect(all).toMatch(/moths? (fly|flies)/);
    expect(all).toMatch(/hedge[^.]*(block|stop)/);
    expect(all).toMatch(/web[^.]*(catch|trap)/);
  });

  it('says how to win, how to get 3 stars and how a level is lost', () => {
    expect(all).toMatch(/win[^.]*every moth/);
    expect(all).toMatch(/lost[^.]*web/);
    expect(all).toMatch(/lost[^.]*turns/);
    expect(all).toMatch(/3 stars/);
  });

  it('names the keys and the Wait button', () => {
    expect(all).toContain('1 to 5');
    expect(all).toContain('space');
    expect(all).toContain('wait');
  });

  it('uses no dash between words', () => {
    for (const s of sentences) expect(s, s).not.toMatch(/\s[-\u2013\u2014]\s|\w-\w/);
  });
});

describe('garden key refusal', () => {
  const start = def.init('g01', 1);
  const lit = { ...start, lit: 1 };

  it('gives the reason of the Wait button for the space key when no lantern is lit', () => {
    const why = gardenInput.refused?.('wait', start);
    expect(why).toBe('Light a lantern first');
    expect(gardenInput.refusedKey?.(' ', start)).toEqual({ anchor: 'wait', text: why });
  });

  it('gives nothing when a lantern is lit, or for another key', () => {
    expect(gardenInput.refusedKey?.(' ', lit)).toBeNull();
    expect(gardenInput.refusedKey?.('z', start)).toBeNull();
    expect(gardenInput.refusedKey?.('1', start)).toBeNull();
  });
});
