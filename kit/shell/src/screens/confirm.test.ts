// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { confirmBox } from './confirm';

// The confirm box holds focus between its two buttons until it closes.

afterEach(() => {
  document.body.innerHTML = '';
});

function open(): { box: HTMLElement; opener: HTMLButtonElement; keep: HTMLElement; del: HTMLElement; seen: string[] } {
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const seen: string[] = [];
  const box = confirmBox(document, {
    message: 'Delete all progress?',
    confirmLabel: 'Delete',
    cancelLabel: 'Keep',
    opener,
    onConfirm: () => {
      seen.push('confirm');
      box.remove();
    },
    onCancel: () => {
      seen.push('cancel');
      box.remove();
    },
  });
  document.body.append(box);
  const keep = box.querySelector<HTMLElement>('[data-control="cancel"]')!;
  const del = box.querySelector<HTMLElement>('[data-control="confirm"]')!;
  keep.focus();
  return { box, opener, keep, del, seen };
}

const press = (target: HTMLElement, key: string, shiftKey = false): boolean =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));

describe('confirm box focus', () => {
  it('cycles between its two buttons with Shift+Tab and never leaves the box', () => {
    const { box, keep, del } = open();
    press(document.activeElement as HTMLElement, 'Tab', true);
    expect(document.activeElement).toBe(del);
    press(document.activeElement as HTMLElement, 'Tab', true);
    expect(document.activeElement).toBe(keep);
    expect(box.contains(document.activeElement)).toBe(true);
  });

  it('cycles between its two buttons with Tab', () => {
    const { keep, del } = open();
    press(document.activeElement as HTMLElement, 'Tab');
    expect(document.activeElement).toBe(del);
    press(document.activeElement as HTMLElement, 'Tab');
    expect(document.activeElement).toBe(keep);
  });

  it('holds the default action of Tab so the browser does not move focus out', () => {
    const { keep } = open();
    expect(press(keep, 'Tab')).toBe(false);
    expect(press(keep, 'Tab', true)).toBe(false);
  });

  it('cancels with Escape and gives focus back to the control that opened it', () => {
    const { opener, keep, seen } = open();
    press(keep, 'Escape');
    expect(seen).toEqual(['cancel']);
    expect(document.activeElement).toBe(opener);
  });

  it('gives focus back to the opener when Keep is pressed', () => {
    const { opener, keep, seen } = open();
    keep.click();
    expect(seen).toEqual(['cancel']);
    expect(document.activeElement).toBe(opener);
  });
});