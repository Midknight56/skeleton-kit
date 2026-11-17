import { describe, expect, it } from 'vitest';
import type { Viewport } from '@kit/core';
import { checkControls, type ControlBox, type Rect } from './layout';

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
