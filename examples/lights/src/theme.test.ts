import { describe, expect, it } from 'vitest';
import { checkTheme } from '@kit/shell';
import { gameTheme } from '../theme';

describe('the theme card', () => {
  it('is a plain card: this game gives the menu card no art', () => {
    expect(gameTheme.cardArt).toBeUndefined();
    expect(checkTheme(gameTheme)).toEqual([]);
  });
});
