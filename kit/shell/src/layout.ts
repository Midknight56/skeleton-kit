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

// The size of one px of the play screen, from the window size. It is 1 up to 360 px wide (or 640 px
// high) and grows to 2 at 1920 by 1080, whichever of width and height gives the smaller value. The
// menus use the same rule in CSS (`--u`).
export function uiScale(width: number, height: number): number {
  const s = 1 + Math.min((width - 360) / 1560, (height - 640) / 440);
  return Math.min(2, Math.max(1, s));
}

// Height of the control strip: a control, 16 px below it, 12 px above it, and the bottom safe inset.
// At scale 1 that is 72 px plus the inset.
export function stripHeight(scale: number, safeBottom: number): number {
  return 28 + Math.round(MIN_SIZE * scale) + safeBottom;
}

// The play screen: a strip of controls under the play area. A control is 44 px high times the scale,
// its bottom is at H - sb - 16, and neighbours are 12 px apart at every scale.
export function playLayout(
  width: number,
  height: number,
  safe: Viewport['safe'],
  controlWidths: number[],
  scale = 1,
): { strip: Rect; canvas: Rect; controls: Rect[] } {
  const stripH = stripHeight(scale, safe.bottom);
  const stripTop = height - stripH;
  const controlH = Math.round(MIN_SIZE * scale);
  const controls: Rect[] = [];
  let x = safe.left + MARGIN;
  for (const w of controlWidths) {
    controls.push({ x, y: height - safe.bottom - MARGIN - controlH, w, h: controlH });
    x += w + MIN_GAP;
  }
  return {
    strip: { x: 0, y: stripTop, w: width, h: stripH },
    canvas: { x: 0, y: 0, w: width, h: stripTop },
    controls,
  };
}

// Limits for a chip next to an anchor. `top` and `bottom` bound the chip's y range: the bottom of the
// top bar and the top of the control strip. `avoid` lists boxes (counter text, buttons) that the chip
// keeps 12 px away from. With limits, the chip also stays touching its anchor or within 12 px of it.
export interface ChipLimits { top?: number; bottom?: number; avoid?: Rect[] }

const NEAR = 12;
// Float slack for a gap that is exactly 12 by construction.
const EPS = 1e-6;

// Where a text chip of size `size` goes next to `anchor`. The chip stays 16 px inside the screen
// and the safe area. Candidates in order: above the anchor, below it, right of it, left of it,
// then above and below shifted by whole chip heights. The first one that overlaps neither the
// anchor nor a chip in `placed` wins. A chip too wide for the screen is pinned to the left limit.
// With `limits` the candidates are 4 px and then 12 px from the anchor (a chip for a button is
// exactly 12 px above it, at the top of the strip), then inside the anchor at its top or bottom
// edge. The first one that meets every limit wins; the shifted candidates are not used.
export function placeChip(
  anchor: Rect,
  size: { w: number; h: number },
  area: { width: number; height: number; safe: Viewport['safe'] },
  placed: Rect[],
  limits?: ChipLimits,
): { x: number; y: number } {
  const minX = area.safe.left + MARGIN;
  const minY = Math.max(area.safe.top + MARGIN, limits?.top ?? -Infinity);
  const maxX = Math.max(minX, area.width - area.safe.right - MARGIN - size.w);
  const maxY = Math.max(minY, Math.min(area.height - area.safe.bottom - MARGIN, limits?.bottom ?? Infinity) - size.h);
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
  if (limits) {
    const right = anchor.x + anchor.w - size.w;
    candidates.push(
      clamp(anchor.x, anchor.y - size.h - NEAR),
      clamp(anchor.x, anchor.y + anchor.h + NEAR),
      clamp(anchor.x + anchor.w + NEAR, anchor.y),
      clamp(anchor.x - size.w - NEAR, anchor.y),
      clamp(right, anchor.y - size.h - gap),
      clamp(right, anchor.y + anchor.h + gap),
      clamp(anchor.x, anchor.y),
      clamp(right, anchor.y),
      clamp(anchor.x, anchor.y + anchor.h - size.h),
      clamp(right, anchor.y + anchor.h - size.h),
    );
    const rectOf = (c: { x: number; y: number }): Rect => ({ x: c.x, y: c.y, w: size.w, h: size.h });
    const fits = (c: { x: number; y: number }, mayOverlapAnchor: boolean): boolean => {
      const rect = rectOf(c);
      if (!mayOverlapAnchor && overlaps(rect, anchor)) return false;
      if (placed.some((p) => overlaps(rect, p))) return false;
      if (gapBetween(rect, anchor) > NEAR + EPS) return false;
      if (rect.y < minY - EPS || rect.y + rect.h > (limits.bottom ?? Infinity) + EPS) return false;
      return !(limits.avoid ?? []).some((a) => gapBetween(rect, a) < NEAR - EPS);
    };
    for (const c of candidates) if (fits(c, false)) return c;
    for (const c of candidates) if (fits(c, true)) return c;
    return candidates.find((c) => !placed.some((p) => overlaps(rectOf(c), p))) ?? candidates[0]!;
  }
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
