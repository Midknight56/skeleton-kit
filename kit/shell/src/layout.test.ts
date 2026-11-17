import { describe, expect, it } from 'vitest';
import type { Viewport } from '@kit/core';
import { checkControls, placeChip, type ControlBox, type Rect } from './layout';

const viewport: Viewport = { width: 360, height: 640, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
const box = (over: Partial<ControlBox> = {}): ControlBox => ({ screen: 'play', id: 'ctl-1', x: 16, y: 580, w: 44, h: 44, ...over });

describe('checkControls at 360 by 640 with no safe inset', () => {
  it('passes a control at x 16, 44 by 44', () => {
    expect(checkControls([box()], viewport)).toEqual([]);
  });

  it('fails a control at x 15 and passes x 16', () => {
    const problems = checkControls([box({ x: 15 })], viewport);
    expect(problems.length).toBe(1);
    expect(problems[0]).toContain('play');
    expect(problems[0]).toContain('ctl-1');
    expect(checkControls([box({ x: 16 })], viewport)).toEqual([]);
  });

  it('fails a width of 43 and passes 44', () => {
    expect(checkControls([box({ w: 43 })], viewport).length).toBe(1);
    expect(checkControls([box({ w: 44 })], viewport)).toEqual([]);
  });

  it('fails a height of 43 and passes 44', () => {
    expect(checkControls([box({ h: 43 })], viewport).length).toBe(1);
  });

  it('fails two boxes 11 px apart and passes 12 px apart', () => {
    const a = box({ id: 'ctl-1', x: 16 });
    const near = box({ id: 'ctl-2', x: 16 + 44 + 11 });
    const far = box({ id: 'ctl-2', x: 16 + 44 + 12 });
    const bad = checkControls([a, near], viewport);
    expect(bad.length).toBe(1);
    expect(bad[0]).toContain('ctl-1');
    expect(bad[0]).toContain('ctl-2');
    expect(checkControls([a, far], viewport)).toEqual([]);
  });

  it('does not compare boxes of two different screens', () => {
    const a = box({ screen: 'title' });
    const b = box({ screen: 'pause', id: 'ctl-2', x: 20 });
    expect(checkControls([a, b], viewport)).toEqual([]);
  });

  it('fails a right edge of 345 and passes 344', () => {
    expect(checkControls([box({ x: 301 })], viewport).length).toBe(1);
    expect(checkControls([box({ x: 300 })], viewport)).toEqual([]);
  });

  it('fails a bottom edge below the viewport minus 16', () => {
    expect(checkControls([box({ y: 581 })], viewport).length).toBe(1);
  });

  it('keeps 16 px from the safe area: left safe inset of 36 fails x 51 and passes x 52', () => {
    const safe: Viewport = { ...viewport, safe: { top: 0, right: 0, bottom: 0, left: 36 } };
    expect(checkControls([box({ x: 51 })], safe).length).toBe(1);
    expect(checkControls([box({ x: 52 })], safe)).toEqual([]);
  });

  it('fails a control that overlaps the play area and passes one below it', () => {
    const playArea: Rect = { x: 0, y: 0, w: 360, h: 568 };
    const over = checkControls([box({ y: 525 })], viewport, playArea);
    expect(over.length).toBe(1);
    expect(over[0]).toContain('play area');
    expect(checkControls([box({ y: 580 })], viewport, playArea)).toEqual([]);
  });
});

describe('placeChip at 360 by 640', () => {
  const area = { width: 360, height: 640, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
  const size = { w: 90, h: 28 };

  it('puts a chip above an anchor, left edges equal, when it fits', () => {
    expect(placeChip({ x: 100, y: 200, w: 72, h: 72 }, size, area, [])).toEqual({ x: 100, y: 168 });
  });

  it('moves a chip from x 0 to x 16', () => {
    expect(placeChip({ x: 0, y: 200, w: 72, h: 72 }, size, area, []).x).toBe(16);
  });

  it('moves a chip at the right edge back so that it ends at 344', () => {
    const at = placeChip({ x: 288, y: 200, w: 72, h: 72 }, size, area, []);
    expect(at.x + size.w).toBe(344);
  });

  it('goes below the anchor when there is no room above', () => {
    expect(placeChip({ x: 100, y: 20, w: 72, h: 72 }, size, area, []).y).toBe(96);
  });

  it('keeps 16 px from the safe area', () => {
    const safe = { ...area, safe: { top: 24, right: 36, bottom: 34, left: 36 } };
    const at = placeChip({ x: 0, y: 200, w: 72, h: 72 }, size, safe, []);
    expect(at.x).toBe(52);
  });

  it('does not overlap a chip already placed', () => {
    const first = placeChip({ x: 100, y: 200, w: 72, h: 72 }, size, area, []);
    const second = placeChip({ x: 110, y: 200, w: 72, h: 72 }, size, area, [{ ...first, ...size }]);
    const a = { ...first, ...size };
    const b = { ...second, ...size };
    const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
    expect(apart).toBe(true);
  });
});

describe('placeChip with limits', () => {
  const area = { width: 1920, height: 1080, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
  const size = { w: 84, h: 27 };

  it('does not go above the top limit and stays within 12 px of the anchor', () => {
    const anchor: Rect = { x: 800, y: 56, w: 317, h: 317 };
    const at = placeChip(anchor, size, area, [], { top: 43 });
    expect(at.y).toBeGreaterThanOrEqual(43);
    expect(at.y).toBe(377);
  });

  it('puts a chip for a button exactly 12 px above it, at the bottom limit', () => {
    const button: Rect = { x: 128, y: 1020, w: 67, h: 44 };
    const at = placeChip(button, size, area, [], { bottom: 1008, avoid: [button] });
    expect(at).toEqual({ x: 128, y: 1008 - 27 });
  });

  it('keeps 12 px from a box to avoid and falls inside the anchor when nothing else fits', () => {
    const anchor: Rect = { x: 16, y: 56, w: 100, h: 100 };
    const wall: Rect = { x: 0, y: 150, w: 1920, h: 400 };
    const at = placeChip(anchor, size, area, [], { top: 56, avoid: [wall, { x: 0, y: 0, w: 1920, h: 10 }] });
    expect(at.y + size.h).toBeLessThanOrEqual(150 - 12);
  });
});
