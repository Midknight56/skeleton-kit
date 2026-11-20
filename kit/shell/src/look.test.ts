// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { TOKENS } from './tokens';
import { FONT_FILES, fontFaceCss } from './fonts';
import { lookCss } from './look';
import { createBackdrop } from './screens/backdrop';
import { titleScreen } from './screens/title';
import { themeCss } from './styles';
import { neutralTheme } from './test-theme';
import { checkTheme } from './theme';
import { WATCH_MESSAGE, watchMessage } from './watch-message';

const noop = () => undefined;
const on = { play: noop, levels: noop, how: noop, settings: noop, credits: noop, watch: noop };
const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`;

describe('tokens', () => {
  it('holds the twelve colours of the look, as lower case #rrggbb', () => {
    const values = Object.values(TOKENS);
    expect(values).toHaveLength(12);
    for (const v of values) expect(v).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('fonts', () => {
  it('declares both families from relative urls and never from another host', () => {
    const css = fontFaceCss('../fonts/');
    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(css).toContain('font-family: "Bricolage Grotesque"');
    expect(css).toContain('font-family: "Sometype Mono"');
    for (const file of FONT_FILES) expect(css).toContain(`url("../fonts/${file}")`);
    expect(css).not.toMatch(/https?:|\/\/|@import/);
  });

  it('is part of the page style, with a system font after each family', () => {
    const css = themeCss(neutralTheme());
    expect(css).toContain('@font-face');
    expect(css).toMatch(/"Bricolage Grotesque", system-ui/);
    expect(css).toMatch(/"Sometype Mono", ui-monospace/);
    expect(css).not.toMatch(/https?:/);
  });
});

describe('look css', () => {
  const css = themeCss(neutralTheme());

  it('keeps the backdrop and the rail out of the way of every pointer', () => {
    expect(css).toMatch(/\[data-backdrop\] \{[^}]*position: fixed;[^}]*inset: 0;[^}]*pointer-events: none;/);
    expect(css).toMatch(/\[data-rail\] \{[^}]*position: fixed;[^}]*pointer-events: none;/);
    expect(css).toMatch(/\[data-garland\] \{[^}]*pointer-events: none;/);
  });

  it('makes the screens clear, so the sky shows through', () => {
    expect(css).toMatch(/\[data-screen\] \{[^}]*background: transparent;/);
  });

  it('draws a sign with a hard bottom edge and no soft shadow', () => {
    expect(css).toContain(`box-shadow: 0 4px 0 ${TOKENS.ink}`);
    expect(css).toContain(`box-shadow: 0 5px 0 ${TOKENS.warmDeep}`);
    expect(css).not.toMatch(/box-shadow:[^;]*\bblur\b/);
  });

  it('stops every sway when the player asks for less motion, and sways only decoration', () => {
    const sway = css.slice(css.indexOf('prefers-reduced-motion: no-preference'));
    expect(css).toContain('prefers-reduced-motion: no-preference');
    expect(sway).toMatch(/\[data-sway\]/);
    expect(sway).toMatch(/rotate\(1\.5deg\)/);
    expect(sway).not.toMatch(/\[data-control\]|button/);
  });

  it('hides the page moon behind every play screen and hides a puppet that was left out', () => {
    expect(css).toMatch(/\[data-backdrop\]\[data-look="play"\] \[data-moon\][^{]*\{[^}]*display: none;/);
    expect(css).toMatch(/\[data-puppet\]\[data-culled\] \{[^}]*display: none;/);
  });

  it('keeps a control 44 px tall at least', () => {
    expect(css).toMatch(/button, a\[data-control\] \{[^}]*min-height: calc\(44 \* var\(--u\)\)/);
  });
});

describe('backdrop', () => {
  const theme = () => ({ ...neutralTheme(), titleArt: { wide: svg('<g data-sway></g>'), narrow: svg('<g></g>') } });

  it('is hidden from the reader, holds the stars, the moon and both arts, and has no control', () => {
    const { sky } = createBackdrop(document, theme());
    expect(sky.hasAttribute('data-backdrop')).toBe(true);
    expect(sky.getAttribute('aria-hidden')).toBe('true');
    expect(sky.querySelector('[data-stars]')).not.toBeNull();
    expect(sky.querySelector('[data-moon]')).not.toBeNull();
    expect(sky.querySelector('[data-art="wide"] svg')).not.toBeNull();
    expect(sky.querySelector('[data-art="narrow"] svg')).not.toBeNull();
    expect(sky.querySelector('button, a, [data-control]')).toBeNull();
  });

  it('puts the stars at fixed places, the same on every call', () => {
    const a = createBackdrop(document, theme()).sky.querySelector('[data-stars]')?.innerHTML;
    const b = createBackdrop(document, theme()).sky.querySelector('[data-stars]')?.innerHTML;
    expect(a).toBe(b);
    expect((a ?? '').match(/<circle/g)?.length).toBeGreaterThan(30);
  });

  it('keeps the stars out of the top 0 to 72 percent only', () => {
    const html = createBackdrop(document, theme()).sky.querySelector('[data-stars]')?.innerHTML ?? '';
    const ys = Array.from(html.matchAll(/cy="([\d.]+)%"/g)).map((m) => Number(m[1]));
    expect(ys.length).toBeGreaterThan(30);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(72);
    }
  });

  it('has a rail that is a separate hidden element', () => {
    const { rail } = createBackdrop(document, theme());
    expect(rail.hasAttribute('data-rail')).toBe(true);
    expect(rail.getAttribute('aria-hidden')).toBe('true');
  });

  it('sets the look, and tells when the scene of the game draws its own moon', () => {
    const plain = createBackdrop(document, theme());
    plain.setLook('play');
    expect(plain.sky.dataset.look).toBe('play');
    expect(plain.sky.dataset.ownMoon).toBeUndefined();
    const own = createBackdrop(document, { ...theme(), sceneMoon: true });
    expect(own.sky.dataset.ownMoon).toBe('true');
  });
});

describe('backdrop keepClear', () => {
  const art = svg('<g data-puppet="a"></g><g data-puppet="b"></g>');
  const theme = () => ({ ...neutralTheme(), titleArt: { wide: art, narrow: art } });
  type R = { left: number; top: number; width: number; height: number };
  const place = (el: Element, r: R): void => {
    const rect = { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => r } as DOMRect;
    Object.defineProperty(el, 'getBoundingClientRect', { value: () => rect, configurable: true });
    Object.defineProperty(el, 'getClientRects', { value: () => [rect], configurable: true });
  };
  const setup = () => {
    const backdrop = createBackdrop(document, theme());
    document.body.replaceChildren(backdrop.sky);
    backdrop.setLook('title');
    const screen = document.createElement('main');
    screen.dataset.screen = 'title';
    const heading = document.createElement('h1');
    const column = document.createElement('div');
    column.dataset.column = '';
    screen.append(heading, column);
    document.body.append(screen);
    place(heading, { left: 40, top: 40, width: 300, height: 60 });
    place(column, { left: 40, top: 200, width: 400, height: 300 });
    const [a, b] = Array.from(backdrop.sky.querySelectorAll('[data-art="wide"] [data-puppet]'));
    return { backdrop, screen, a: a as Element, b: b as Element };
  };

  it('hides a puppet whose box meets the heading or the column, and keeps one that is clear of them', () => {
    const { backdrop, screen, a, b } = setup();
    place(a, { left: 450, top: 250, width: 100, height: 100 });
    place(b, { left: 600, top: 250, width: 100, height: 100 });
    backdrop.keepClear(screen);
    expect(a.hasAttribute('data-culled')).toBe(true);
    expect(b.hasAttribute('data-culled')).toBe(false);
  });

  it('hides a puppet that is only near enough to touch a control, and shows it again when it moves away', () => {
    const { backdrop, screen, a, b } = setup();
    place(a, { left: 30, top: 120, width: 20, height: 400 });
    place(b, { left: 900, top: 10, width: 20, height: 20 });
    backdrop.keepClear(screen);
    expect(a.hasAttribute('data-culled')).toBe(true);
    place(a, { left: 900, top: 300, width: 20, height: 20 });
    backdrop.keepClear(screen);
    expect(a.hasAttribute('data-culled')).toBe(false);
  });

  it('leaves every puppet alone when the screen has no box yet', () => {
    const { backdrop, screen, a, b } = setup();
    for (const el of Array.from(screen.children)) place(el, { left: 0, top: 0, width: 0, height: 0 });
    place(a, { left: 0, top: 0, width: 50, height: 50 });
    place(b, { left: 0, top: 0, width: 50, height: 50 });
    backdrop.keepClear(screen);
    expect(a.hasAttribute('data-culled')).toBe(false);
    expect(b.hasAttribute('data-culled')).toBe(false);
  });
});

describe('theme art check', () => {
  it('passes a plain svg art', () => {
    expect(checkTheme({ ...neutralTheme(), titleArt: { wide: svg('<path d="M0 0L5 5Z" fill="url(#g)"/>'), narrow: svg('') } })).toEqual([]);
  });

  it('refuses a script, an image, an event handler and a url that leaves the page', () => {
    const bad = [
      svg('<script>1</script>'),
      svg('<image href="a.png"/>'),
      svg('<g onload="x()"/>'),
      svg('<rect fill="url(https://x.test/a)"/>'),
      svg('<use href="https://x.test/a.svg#b"/>'),
      '<div></div>',
    ];
    for (const art of bad) {
      expect(checkTheme({ ...neutralTheme(), titleArt: { wide: art, narrow: svg('') } }), art).not.toEqual([]);
    }
  });
});

describe('title screen look', () => {
  it('shows the tagline of the game after the heading', () => {
    const root = titleScreen(document, { title: 'T', tagline: 'Tap to jump.', showNotice: false, on });
    const p = root.querySelector('p[data-tagline]');
    expect(p?.textContent).toBe('Tap to jump.');
    expect(root.firstElementChild?.tagName).toBe('H1');
  });

  it('keeps the same controls in the same order with a garland', () => {
    const garland = { lit: svg('<g/>'), unlit: svg('<g/>'), finished: [true, true, false, false] };
    const root = titleScreen(document, { title: 'T', showNotice: false, on, garland });
    expect(Array.from(root.querySelectorAll<HTMLElement>('[data-column] [data-control]')).map((b) => b.dataset.control)).toEqual(['play', 'watch', 'levels', 'how', 'settings', 'credits']);
  });

  it('draws the garland as a picture: hidden from the reader, one item for each level, no control', () => {
    const garland = { lit: svg('<g/>'), unlit: svg('<g/>'), finished: [true, true, false, false] };
    const root = titleScreen(document, { title: 'T', showNotice: false, on, garland });
    const el = root.querySelector('[data-garland]');
    expect(el?.getAttribute('aria-hidden')).toBe('true');
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-garland] [data-garland-item]'));
    expect(items.map((i) => i.dataset.lit)).toEqual(['true', 'true', 'false', 'false']);
    expect(items.map((i) => i.dataset.ring)).toEqual(['false', 'false', 'true', 'false']);
    expect(el?.querySelector('button, a, [data-control], [tabindex]')).toBeNull();
    expect(el?.textContent).toContain('next: level 3 of 4');
  });

  it('puts no ring on any item when every level is finished', () => {
    const garland = { lit: svg('<g/>'), unlit: svg('<g/>'), finished: [true, true] };
    const root = titleScreen(document, { title: 'T', showNotice: false, on, garland });
    expect(Array.from(root.querySelectorAll('[data-ring="true"]'))).toHaveLength(0);
    expect(root.querySelector('[data-garland]')?.textContent).toContain('all 2 levels done');
  });

  it('has no garland when the game gives none', () => {
    expect(titleScreen(document, { title: 'T', showNotice: false, on }).querySelector('[data-garland]')).toBeNull();
  });
});

describe('watch message', () => {
  it('names the message and builds it from the numbers of the run', () => {
    expect(WATCH_MESSAGE).toBe('skeleton-kit:watch');
    expect(watchMessage('g03', 2, 4, 1)).toEqual({ type: 'skeleton-kit:watch', level: 'g03', applied: 2, total: 4, round: 1 });
  });
});

describe('garland text', () => {
  const MIN = 12;
  const css = lookCss(neutralTheme());
  const CALC = /^calc\(\s*(\d+(?:\.\d+)?)px\s*\+\s*(-?\d+(?:\.\d+)?)\s*\*\s*\(var\(--u\)\s*-\s*1px\)\s*\)$/;
  const PLAIN = /^(\d+(?:\.\d+)?)px$/;

  // Every `font-size` of a rule whose selector starts with `[data-garland]`, media blocks included.
  const declarations = (): { selector: string; value: string }[] => {
    const found: { selector: string; value: string }[] = [];
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = (m[1] ?? '').trim();
      if (!selector.startsWith('[data-garland]')) continue;
      for (const d of (m[2] ?? '').matchAll(/(?:^|;)\s*font-size:\s*([^;]+)/g)) {
        found.push({ selector, value: (d[1] ?? '').trim() });
      }
    }
    return found;
  };

  const sizeAt = (value: string, u: number): number | undefined => {
    const calc = CALC.exec(value);
    if (calc) return Number(calc[1]) + Number(calc[2]) * (u - 1);
    const plain = PLAIN.exec(value);
    return plain ? Number(plain[1]) : undefined;
  };

  it('has at least two garland font sizes, each one readable', () => {
    const all = declarations();
    expect(all.length).toBeGreaterThanOrEqual(2);
    for (const { selector, value } of all) {
      expect(sizeAt(value, 1), `${selector}: cannot read font-size "${value}"`).toBeDefined();
    }
  });

  it(`keeps every garland font size at ${MIN}px or more at both ends of --u`, () => {
    const failures: string[] = [];
    for (const { selector, value } of declarations()) {
      for (const [end, u] of [['small end (--u 1px)', 1], ['large end (--u 2px)', 2]] as const) {
        const size = sizeAt(value, u);
        if (size === undefined) failures.push(`${selector} ${end}: unreadable "${value}"`);
        else if (size < MIN) failures.push(`${selector} at the ${end} is ${size}px, under ${MIN}px`);
      }
    }
    expect(failures).toEqual([]);
  });
});
