import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkControls, describeFacts, type ControlBox, type LevelFacts } from '@kit/shell';
import type { Page } from '@playwright/test';
import { control, expect, levelIds, screen, test } from './fixtures';

// The level select screen shows the proven facts of each level as pips, and states the exact numbers in
// the name of the card and in data attributes. This test reads proofs/<game>/index.json and compares.
// With every level open, it measures the pip row, the cards and the page. All data comes from a real page.

const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 768, height: 1024 },
  { width: 1920, height: 1080 },
];

interface Rect { x: number; y: number; w: number; h: number }
interface Card {
  id: string;
  actions: string | undefined;
  firstLegal: string | undefined;
  firstWin: string | undefined;
  label: string;
  pips: number;
  pipsOn: number;
  pipsHidden: boolean;
  rect: Rect;
  row: Rect | null;
  number: Rect;
  stars: Rect;
}
interface Measured { cards: Card[]; back: Rect; scrolls: boolean; scrollsWithoutPips: boolean }

interface IndexItem { id: string; actions: number; firstMoves?: { legal: number; winning: number }; window?: number }

function readIndex(game: string): IndexItem[] {
  const path = fileURLToPath(new URL(`../proofs/${game}/index.json`, import.meta.url));
  const levels = (JSON.parse(readFileSync(path, 'utf8')) as { levels: IndexItem[] }).levels;
  // A runner course also has the smallest window of its proof, in the check window_ok.
  return levels.map((item) => {
    const proofPath = fileURLToPath(new URL(`../proofs/${game}/${item.id}.json`, import.meta.url));
    const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as { kind?: string; checks: { name: string; detail: string }[] };
    const found = /^smallest window (\d+) ticks/.exec(proof.checks.find((c) => c.name === 'window_ok')?.detail ?? '');
    return proof.kind === 'tick' && found ? { ...item, window: Number(found[1]) } : item;
  });
}

// Compares the cards of the page with the items of the index. It returns one text for each difference.
export function compareFacts(cards: Card[], items: IndexItem[], kind: 'turn' | 'tick'): string[] {
  const problems: string[] = [];
  if (cards.length !== items.length) problems.push(`the screen has ${cards.length} cards, the index has ${items.length} levels`);
  for (const item of items) {
    const card = cards.find((c) => c.id === item.id);
    if (!card) {
      problems.push(`${item.id}: no card`);
      continue;
    }
    const facts: LevelFacts = { actions: item.actions, ...(item.firstMoves ? { firstMoves: item.firstMoves } : {}), ...(item.window ? { window: item.window } : {}) };
    const expected = describeFacts(facts, kind);
    if (card.actions !== String(item.actions)) problems.push(`${item.id}: data-actions is ${card.actions}, the index says ${item.actions}`);
    if (card.firstLegal !== (item.firstMoves ? String(item.firstMoves.legal) : undefined)) problems.push(`${item.id}: data-first-legal is ${card.firstLegal}, the index says ${item.firstMoves?.legal}`);
    if (card.firstWin !== (item.firstMoves ? String(item.firstMoves.winning) : undefined)) problems.push(`${item.id}: data-first-win is ${card.firstWin}, the index says ${item.firstMoves?.winning}`);
    // The numbers parsed from the accessible name.
    const m = /wins in (\d+)(?:, (\d+) of (\d+) first moves? wins?)?(?: ticks)?(?:, tightest jump \d+ steps?, about \d+ ms)?$/.exec(card.label);
    if (!m) {
      problems.push(`${item.id}: the name "${card.label}" does not end with the facts`);
    } else {
      if (Number(m[1]) !== item.actions) problems.push(`${item.id}: the name says ${m[1]} actions, the index says ${item.actions}`);
      if (item.firstMoves) {
        if (Number(m[2]) !== item.firstMoves.winning) problems.push(`${item.id}: the name says ${m[2]} winning, the index says ${item.firstMoves.winning}`);
        if (Number(m[3]) !== item.firstMoves.legal) problems.push(`${item.id}: the name says ${m[3]} legal, the index says ${item.firstMoves.legal}`);
      } else if (m[2] !== undefined) {
        problems.push(`${item.id}: the name has first moves, the index has none`);
      }
    }
    if (!card.label.endsWith(expected.text)) problems.push(`${item.id}: the name "${card.label}" does not end with "${expected.text}"`);
    if (card.pips !== expected.total) problems.push(`${item.id}: ${card.pips} pips, expected ${expected.total}`);
    if (card.pipsOn !== expected.filled) problems.push(`${item.id}: ${card.pipsOn} filled pips, expected ${expected.filled}`);
    if (expected.total > 0 && !card.pipsHidden) problems.push(`${item.id}: the pip row is not hidden from the screen reader`);
  }
  return problems;
}

const inside = (inner: Rect, outer: Rect, pad: number): boolean =>
  inner.x >= outer.x + pad - 0.5 && inner.y >= outer.y + pad - 0.5 && inner.x + inner.w <= outer.x + outer.w - pad + 0.5 && inner.y + inner.h <= outer.y + outer.h - pad + 0.5;
const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
const separation = (a: Rect, b: Rect): number => Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), a.y - (b.y + b.h), b.y - (a.y + a.h));

export function measureProblems(m: Measured, viewport: { width: number; height: number }): string[] {
  const problems: string[] = [];
  for (const card of m.cards) {
    if (card.row) {
      if (!inside(card.row, card.rect, 8)) problems.push(`${card.id}: the pip row is not inside the card with 8 px padding`);
      if (overlap(card.row, card.number)) problems.push(`${card.id}: the pip row overlaps the level number`);
      if (overlap(card.row, card.stars)) problems.push(`${card.id}: the pip row overlaps the stars`);
      if (card.row.y < card.stars.y + card.stars.h - 0.5) problems.push(`${card.id}: the pip row is not under the stars`);
    }
    if (card.rect.x < 16 - 0.5 || card.rect.x + card.rect.w > viewport.width - 16 + 0.5) problems.push(`${card.id}: the card is less than 16 px inside the screen across`);
    if (overlap(card.rect, m.back)) problems.push(`${card.id}: the card is over the Back button`);
  }
  for (let i = 0; i < m.cards.length; i++) {
    for (let j = i + 1; j < m.cards.length; j++) {
      const gap = separation(m.cards[i]!.rect, m.cards[j]!.rect);
      if (gap < 11.5) problems.push(`${m.cards[i]!.id} and ${m.cards[j]!.id} are ${gap.toFixed(1)} px apart, limit 12`);
    }
  }
  if (m.scrolls && !m.scrollsWithoutPips) problems.push('the pips make the page scroll');
  return problems;
}

async function measure(page: Page): Promise<Measured> {
  return page.evaluate(() => {
    const box = (el: Element): { x: number; y: number; w: number; h: number } => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const scrolls = (): boolean => {
      const doc = document.scrollingElement as HTMLElement;
      return doc.scrollHeight > window.innerHeight || doc.scrollWidth > window.innerWidth;
    };
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-screen="levels"] [data-control^="level-"]')).map((tile) => {
      const row = tile.querySelector<HTMLElement>('[data-pips]');
      const pipEls = row ? Array.from(row.querySelectorAll('i')) : [];
      return {
        id: (tile.dataset.control ?? '').slice('level-'.length),
        actions: tile.dataset.actions,
        firstLegal: tile.dataset.firstLegal,
        firstWin: tile.dataset.firstWin,
        label: tile.getAttribute('aria-label') ?? '',
        pips: pipEls.length,
        pipsOn: pipEls.filter((p) => p.hasAttribute('data-on')).length,
        pipsHidden: row?.getAttribute('aria-hidden') === 'true',
        rect: box(tile),
        row: row ? box(row) : null,
        number: box(tile.querySelector('span') as Element),
        stars: box(tile.querySelector('[data-stars]') as Element),
      };
    });
    const withPips = scrolls();
    const style = document.createElement('style');
    style.textContent = '[data-pips] { display: none !important; }';
    document.head.append(style);
    const without = scrolls();
    style.remove();
    return { cards, back: box(document.querySelector('[data-control="back"]') as Element), scrolls: withPips, scrollsWithoutPips: without };
  });
}

const GAMES = [
  { id: 'garden', kind: 'turn' as const },
  { id: 'runner', kind: 'tick' as const },
];

for (const game of GAMES) {
  for (const viewport of VIEWPORTS) {
    test(`${game.id} level cards show the proof facts at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const progress = Object.fromEntries(levelIds(game.id).map((id) => [id, { stars: 1, best: 1 }]));
      await page.addInitScript(
        ([key, data]) => window.localStorage.setItem(key as string, JSON.stringify(data)),
        [`kit.${game.id}.v1`, { version: 1, levels: progress, settings: { sound: true, music: true, usage: true }, lessons: {} }],
      );
      await page.goto(`/${game.id}/`);
      await expect(screen(page, 'title')).toBeVisible();
      await control(page, 'levels').click();
      await expect(screen(page, 'levels')).toBeVisible();
      // The pointer that clicked Levels now rests on the first card, and its hover swing rotates that card.
      // Move it off and let every one shot animation end, so the boxes are the settled layout.
      await page.mouse.move(0, 0);
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => {
              const timing = a.effect?.getComputedTiming();
              return timing !== undefined && Number.isFinite(timing.endTime as number);
            })
            .map((a) => a.finished.catch(() => undefined)),
        ),
      );

      const items = readIndex(game.id);
      const m = await measure(page);
      expect(m.cards.every((c) => c.label.length > 0)).toBe(true);
      expect(m.cards.some((c) => c.id === ''), 'a card without an id').toBe(false);
      for (const c of m.cards) expect(await page.locator(`[data-control="level-${c.id}"]`).getAttribute('data-locked'), `${c.id} is open`).toBe('false');

      expect(compareFacts(m.cards, items, game.kind), 'the cards match the proof index').toEqual([]);
      if (game.kind === 'tick') expect(m.cards.every((c) => c.pips === 0 && c.row === null), 'tick cards have no pips').toBe(true);
      else expect(m.cards.every((c) => c.pips > 0), 'turn cards have pips').toBe(true);

      const controls: ControlBox[] = [
        ...m.cards.map((c) => ({ screen: 'levels', id: `level-${c.id}`, ...c.rect })),
        { screen: 'levels', id: 'back', ...m.back },
      ];
      const problems = [...measureProblems(m, viewport), ...checkControls(controls, { ...viewport, safe: { top: 0, right: 0, bottom: 0, left: 0 } })];
      expect(problems, `${game.id} at ${viewport.width}x${viewport.height}`).toEqual([]);

      // A page whose numbers differ from the index must report a mismatch.
      const changed = items.map((item, i) => (i === 0 ? { ...item, actions: item.actions + 1 } : item));
      expect(compareFacts(m.cards, changed, game.kind).length, 'a changed number is reported').toBeGreaterThan(0);
      if (game.kind === 'turn') {
        const firstMoves = items.map((item, i) => (i === 0 && item.firstMoves ? { ...item, firstMoves: { ...item.firstMoves, winning: item.firstMoves.winning + 1 } } : item));
        expect(compareFacts(m.cards, firstMoves, game.kind).length, 'a changed winning number is reported').toBeGreaterThan(0);
      }
    });
  }
}
