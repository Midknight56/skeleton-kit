import { describe, expect, it } from 'vitest';
import { motionCss } from './motion';
import { themeCss } from './styles';
import { neutralTheme } from './test-theme';

const MOVING = '@media not all and (prefers-reduced-motion: reduce)';
const css = motionCss();
const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
const normal = css.slice(css.indexOf(MOVING), css.indexOf('@media (prefers-reduced-motion: reduce)'));

describe('motionCss', () => {
  it('is part of the page style of a game, before the look so the look test still reads its own block', () => {
    const page = themeCss(neutralTheme());
    expect(page).toContain(css);
    expect(page.indexOf(css)).toBeLessThan(page.indexOf('[data-backdrop]'));
  });

  it('puts every motion except the 150 ms fade inside a query that reduced motion switches off', () => {
    expect(css.indexOf(MOVING)).toBeGreaterThanOrEqual(0);
    // The look keeps its own no-preference block, and its test reads everything after it.
    expect(css).not.toContain('prefers-reduced-motion: no-preference');
    expect(reduce).not.toMatch(/rotate|translate|infinite|kit-swing|kit-drop|kit-lift/);
    const outside = css.replace(normal, '').replace(reduce, '');
    expect(outside).not.toMatch(/animation|transition/);
  });

  it('swings a button once in 600 ms when the pointer is over it', () => {
    expect(normal).toMatch(/button:hover[^{]*\{[^}]*animation: kit-swing 600ms[^;]* 1[;\s]/);
    expect(normal).toMatch(/@keyframes kit-swing/);
    expect(normal).toMatch(/@media \(hover: hover\)/);
  });

  it('drops a pressed button 3 px in 80 ms and springs it back in 220 ms', () => {
    expect(normal).toMatch(/transition: transform 220ms/);
    // The look sets an 80 ms transition on a plain `button`, so these rules name the root to win.
    expect(normal).toMatch(/\[data-kit-root\] button/);
    expect(normal).toMatch(/:active[^{]*\{[^}]*translateY\(3px\)/);
    expect(normal).toMatch(/:active[^{]*\{[^}]*transition-duration: 80ms/);
  });

  it('sways the strings of a card by 1.5 degrees on loops of 4 to 6 seconds, each with its own phase', () => {
    const sway = normal.slice(normal.indexOf('kit-string-sway'));
    expect(sway).toMatch(/rotate\(-1\.5deg\)/);
    expect(sway).toMatch(/rotate\(1\.5deg\)/);
    const seconds = [...normal.matchAll(/kit-string-sway ([\d.]+)s/g)].map((m) => Number(m[1]));
    expect(seconds.length).toBeGreaterThanOrEqual(2);
    for (const s of seconds) {
      expect(s).toBeGreaterThanOrEqual(4);
      expect(s).toBeLessThanOrEqual(6);
    }
    expect(new Set(seconds).size).toBe(seconds.length);
    expect(normal).toMatch(/\[data-garland-item\]/);
    expect(normal).toMatch(/kit-garland-sway/);
  });

  it('does not sway or move a control, a heading or the card itself', () => {
    const animated = [...normal.matchAll(/([^{}]+)\{[^{}]*animation:[^{}]*\}/g)].map((m) => (m[1] ?? '').trim());
    for (const selector of animated) {
      if (/button|a\[data-control\]/.test(selector)) expect(selector).toMatch(/:hover/);
      else expect(selector).toMatch(/::before|::after|data-garland|data-lift|data-screen/);
    }
    expect(normal).not.toMatch(/\[data-card\](?::not\([^)]*\))?\s*\{[^}]*(transform|translate|rotate)/);
  });

  it('drops the strings of a new card in 450 ms with an 8 px overshoot and 40 ms apart', () => {
    expect(normal).toMatch(/kit-string-drop 450ms/);
    expect(normal).toMatch(/\d+% \{[^}]*translate: 0 8px/);
    expect(normal).toMatch(/animation-delay: 40ms/);
  });

  it('lifts the ghost of the old card out in 300 ms', () => {
    expect(normal).toMatch(/\[data-lift\][^{]*\{[^}]*animation: kit-lift 300ms/);
  });

  it('cross fades a new screen in 150 ms with reduced motion, and moves nothing', () => {
    expect(reduce).toMatch(/animation: kit-fade 150ms/);
    expect(reduce).toMatch(/@keyframes kit-fade/);
  });

  it('keeps the play and watch screens still', () => {
    expect(css).toMatch(/:not\(\[data-screen="play"\]\):not\(\[data-screen="watch"\]\)/);
  });
});
