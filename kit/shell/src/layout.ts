import type { Viewport } from '@kit/core';

export interface Rect { x: number; y: number; w: number; h: number }
export interface ControlBox { screen: string; id: string; x: number; y: number; w: number; h: number }

const MARGIN = 16;
const MIN_SIZE = 44;
const MIN_GAP = 12;

function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0);
  const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
  return Math.hypot(dx, dy);
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// The play screen: a strip of controls under the play area. The strip is 72 px high plus the
// bottom safe inset. A control is 44 px high, its top is at H - sb - 60 and its bottom at H - sb - 16.
export function playLayout(
  width: number,
  height: number,
  safe: Viewport['safe'],
  controlWidths: number[],
): { strip: Rect; canvas: Rect; controls: Rect[] } {
  const stripHeight = 72 + safe.bottom;
  const stripTop = height - stripHeight;
  const controls: Rect[] = [];
  let x = safe.left + MARGIN;
  for (const w of controlWidths) {
    controls.push({ x, y: height - safe.bottom - 60, w, h: MIN_SIZE });
    x += w + MIN_GAP;
  }
  return {
    strip: { x: 0, y: stripTop, w: width, h: stripHeight },
    canvas: { x: 0, y: 0, w: width, h: stripTop },
    controls,
  };
}

// Where a text chip of size `size` goes next to `anchor`. The chip stays 16 px inside the screen
// and the safe area. Candidates in order: above the anchor, below it, right of it, left of it,
// then above and below shifted by whole chip heights. The first one that overlaps neither the
// anchor nor a chip in `placed` wins. A chip too wide for the screen is pinned to the left limit.
export function placeChip(
  anchor: Rect,
  size: { w: number; h: number },
  area: { width: number; height: number; safe: Viewport['safe'] },
  placed: Rect[],
): { x: number; y: number } {
  const minX = area.safe.left + MARGIN;
  const minY = area.safe.top + MARGIN;
  const maxX = Math.max(minX, area.width - area.safe.right - MARGIN - size.w);
  const maxY = Math.max(minY, area.height - area.safe.bottom - MARGIN - size.h);
  const clamp = (x: number, y: number) => ({ x: Math.min(Math.max(x, minX), maxX), y: Math.min(Math.max(y, minY), maxY) });
  const gap = 4;
  const above = anchor.y - size.h - gap;
  const below = anchor.y + anchor.h + gap;
  const step = size.h + gap;
  const candidates = [
    clamp(anchor.x, above),
    clamp(anchor.x, below),
    clamp(anchor.x + anchor.w + gap, anchor.y),
    clamp(anchor.x - size.w - gap, anchor.y),
  ];
  for (let k = 1; k <= 8; k++) candidates.push(clamp(anchor.x, above - k * step), clamp(anchor.x, below + k * step));
  for (const c of candidates) {
    const rect = { x: c.x, y: c.y, w: size.w, h: size.h };
    if (!overlaps(rect, anchor) && !placed.some((p) => overlaps(rect, p))) return c;
  }
  return candidates[0]!;
}

// Returns one line for each layout problem. An empty list means every control fits.
export function checkControls(boxes: ControlBox[], viewport: Viewport, playArea?: Rect): string[] {
  const problems: string[] = [];
  const left = viewport.safe.left + MARGIN;
  const top = viewport.safe.top + MARGIN;
  const right = viewport.width - viewport.safe.right - MARGIN;
  const bottom = viewport.height - viewport.safe.bottom - MARGIN;
  for (const b of boxes) {
    const name = `${b.screen}: ${b.id}`;
    if (b.x < left) problems.push(`${name} starts at x ${b.x}, left limit is ${left}`);
    if (b.y < top) problems.push(`${name} starts at y ${b.y}, top limit is ${top}`);
    if (b.x + b.w > right) problems.push(`${name} ends at x ${b.x + b.w}, right limit is ${right}`);
    if (b.y + b.h > bottom) problems.push(`${name} ends at y ${b.y + b.h}, bottom limit is ${bottom}`);
    if (b.w < MIN_SIZE) problems.push(`${name} is ${b.w} px wide, minimum is ${MIN_SIZE}`);
    if (b.h < MIN_SIZE) problems.push(`${name} is ${b.h} px high, minimum is ${MIN_SIZE}`);
    if (playArea && overlaps(b, playArea)) problems.push(`${name} overlaps the play area`);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if (a.screen !== b.screen) continue;
      const gap = gapBetween(a, b);
      if (gap < MIN_GAP) problems.push(`${a.screen}: ${a.id} and ${b.id} are ${gap.toFixed(0)} px apart, minimum is ${MIN_GAP}`);
    }
  }
  return problems;
}
