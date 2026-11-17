import { describe, expect, it } from 'vitest';
import { checkTheme, contrastRatio } from './theme';
import { neutralTheme } from './test-theme';

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for the same colour', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });
});

describe('checkTheme', () => {
  it('passes a saturated theme with readable text', () => {
    expect(checkTheme(neutralTheme())).toEqual([]);
  });

  it('fails a grey primary colour and names primary', () => {
    const problems = checkTheme(neutralTheme({ primary: '#808080' }));
    expect(problems.some((p) => p.includes('primary'))).toBe(true);
  });

  it('fails a grey secondary colour and names secondary', () => {
    const problems = checkTheme(neutralTheme({ secondary: '#777777' }));
    expect(problems.some((p) => p.includes('secondary'))).toBe(true);
  });

  it('fails text with a contrast below 4.5 and names text', () => {
    const problems = checkTheme(neutralTheme({ text: '#2a3a5a' }));
    expect(problems.some((p) => p.includes('text'))).toBe(true);
  });

  it('fails a grey theme on every count', () => {
    const grey = neutralTheme({ primary: '#888888', secondary: '#999999', background: '#aaaaaa', text: '#bbbbbb' });
    expect(checkTheme(grey).length).toBeGreaterThanOrEqual(3);
  });
});
