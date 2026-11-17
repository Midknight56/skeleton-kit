import { describe, expect, it } from 'vitest';
import { gardenTheme } from '../apps/garden/theme';
import { runnerTheme } from '../apps/runner/theme';

// Requirement 9.3: the two shipped themes differ in palette, button radius and signature shape.
describe('the two shipped themes', () => {
  it('differ in palette.primary', () => {
    expect(runnerTheme.palette.primary.toLowerCase()).not.toBe(gardenTheme.palette.primary.toLowerCase());
  });

  it('differ in buttonRadius', () => {
    expect(runnerTheme.buttonRadius).not.toBe(gardenTheme.buttonRadius);
  });

  it('differ in signature', () => {
    expect(runnerTheme.signature).not.toBe(gardenTheme.signature);
  });

  it('differ in the rest of the palette too, not in one colour only', () => {
    const same = Object.keys(gardenTheme.palette).filter(
      (name) => gardenTheme.palette[name as keyof typeof gardenTheme.palette].toLowerCase() === runnerTheme.palette[name as keyof typeof runnerTheme.palette].toLowerCase(),
    );
    // Both themes may share white text. No other colour may match.
    expect(same.filter((name) => name !== 'text')).toEqual([]);
  });
});
