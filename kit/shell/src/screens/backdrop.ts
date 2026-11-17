import type { Theme } from '../theme';

// The sky of every screen of a game: a gradient, a star field, one moon and, on the title screen, the
// puppets of the game on their strings. The rail is a second element, drawn above the screens.
// Both are pictures. They are hidden from the reader and ignore every pointer.
export type Look = 'title' | 'menu' | 'play';

export interface Backdrop {
  sky: HTMLElement;
  rail: HTMLElement;
  setLook(look: Look): void;
  // Hides each puppet of the title art whose box comes near the heading, a text line or the menu column
  // of screen, and shows the others. It runs again when the screen changes size.
  keepClear(screen: Element | null): void;
}

// How far a puppet stays from the text and the controls, in px. It covers the sway of a string.
const CLEARANCE = 24;
const KEEP_CLEAR = 'h1, h2, p, [data-column]';

function near(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right + CLEARANCE && b.left < a.right + CLEARANCE && a.top < b.bottom + CLEARANCE && b.top < a.bottom + CLEARANCE;
}

// A small fixed generator, so the stars sit in the same places on every visit.
function stars(count: number): string {
  let seed = 20240917;
  const next = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const dots: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = (next() * 100).toFixed(2);
    const y = (next() * 72).toFixed(2);
    const r = next() < 0.2 ? 1.2 : 0.9;
    const alpha = (0.3 + next() * 0.5).toFixed(2);
    dots.push(`<circle cx="${x}%" cy="${y}%" r="${r}" fill="#efe7d2" fill-opacity="${alpha}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" focusable="false">${dots.join('')}</svg>`;
}

export function createBackdrop(doc: Document, theme: Theme): Backdrop {
  const sky = doc.createElement('div');
  sky.setAttribute('data-backdrop', '');
  sky.setAttribute('aria-hidden', 'true');
  sky.dataset.look = 'menu';
  if (theme.sceneMoon === true) sky.dataset.ownMoon = 'true';

  const field = doc.createElement('div');
  field.setAttribute('data-stars', '');
  field.innerHTML = stars(64);

  const moon = doc.createElement('div');
  moon.setAttribute('data-moon', '');
  for (const crater of ['a', 'b', 'c']) {
    const dot = doc.createElement('span');
    dot.dataset.crater = crater;
    moon.append(dot);
  }

  sky.append(field, moon);
  if (theme.titleArt) {
    for (const kind of ['wide', 'narrow'] as const) {
      const art = doc.createElement('div');
      art.dataset.art = kind;
      art.innerHTML = theme.titleArt[kind];
      sky.append(art);
    }
  }

  const rail = doc.createElement('div');
  rail.setAttribute('data-rail', '');
  rail.setAttribute('aria-hidden', 'true');

  let current: Element | null = null;
  let watching: ResizeObserver | null = null;

  function keepClear(screen: Element | null): void {
    const puppets = Array.from(sky.querySelectorAll('[data-puppet]'));
    for (const puppet of puppets) puppet.removeAttribute('data-culled');
    if (!screen) return;
    const avoid = Array.from(screen.querySelectorAll(KEEP_CLEAR))
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    if (avoid.length === 0) return;
    for (const puppet of puppets) {
      if (puppet.getClientRects().length === 0) continue;
      const box = puppet.getBoundingClientRect();
      if (avoid.some((r) => near(box, r))) puppet.setAttribute('data-culled', '');
    }
  }

  return {
    sky,
    rail,
    setLook(look) {
      sky.dataset.look = look;
      rail.dataset.look = look;
    },
    keepClear(screen) {
      current = screen;
      keepClear(screen);
      // The menu changes size with the window and when the fonts arrive. Then the puppets are placed again.
      const win = doc.defaultView;
      if (!watching && win && 'ResizeObserver' in win) {
        watching = new win.ResizeObserver(() => keepClear(current));
        watching.observe(sky);
      }
      if (watching && screen) for (const el of Array.from(screen.querySelectorAll(KEEP_CLEAR))) watching.observe(el);
    },
  };
}
