import type { Viewport } from '@kit/core';
import { placeChip, type Rect } from './layout';
import type { ProgressStore } from './storage';
import type { Lesson } from './types';

export const MAX_SHOWINGS = 3;
const MAX_LESSONS = 4;
const MAX_WORDS = 2;

// The lessons to show at a level start. Only the first level shows lessons. Each showing is
// counted in storage, and a lesson that was shown 3 times is never shown again.
export function lessonsToShow(store: ProgressStore, lessons: Lesson[], isFirstLevel: boolean): Lesson[] {
  if (!isFirstLevel) return [];
  const shown: Lesson[] = [];
  for (const lesson of lessons) {
    if (store.lessonCount(lesson.id) >= MAX_SHOWINGS) continue;
    store.bumpLesson(lesson.id);
    shown.push(lesson);
  }
  return shown;
}

// Problems of a game's lesson list: repeated ids, texts over 2 words, more than 4 lessons.
export function lessonProblems(lessons: Lesson[]): string[] {
  const problems: string[] = [];
  if (lessons.length > MAX_LESSONS) problems.push(`${lessons.length} lessons, at most ${MAX_LESSONS}`);
  const seen = new Set<string>();
  for (const lesson of lessons) {
    if (seen.has(lesson.id)) problems.push(`lesson id "${lesson.id}" is used twice`);
    seen.add(lesson.id);
    const words = lesson.text.trim().split(/\s+/).filter((w) => w !== '').length;
    if (words > MAX_WORDS) problems.push(`lesson "${lesson.id}" has ${words} words, at most ${MAX_WORDS}`);
  }
  return problems;
}

export interface Hints { remove(): void }

// The screen a hint sits on: its size, its safe insets and the small type size of the theme.
// `top` is the bottom of the top bar and `bottom` the top of the control strip. `avoid` lists boxes that
// a chip keeps 12 px away from (counter text, buttons). With any of the three, a chip also stays
// touching its anchor or within 12 px of it. obstacles lists the boxes of the scene items: a chip never overlaps one.
export interface HintArea { width: number; height: number; safe: Viewport['safe']; fontSize: number; scale?: number; top?: number; bottom?: number; avoid?: Rect[]; obstacles?: Rect[] }

// A chip size from its text, for a page that has no layout (a letter is 0.7 em, padding 8 px a side).
export function estimateChip(text: string, fontSize: number): { w: number; h: number } {
  return { w: Math.ceil(text.length * fontSize * 0.7) + 16, h: Math.ceil(fontSize * 1.4) + 8 };
}

// Puts one hint box beside the box of each lesson anchor. A hint takes no pointer events.
// A lesson whose anchor has no box is skipped. Each hint keeps 16 px from the screen and the
// safe area, and does not overlap another hint. The text keeps its size; the box moves.
export function showHints(doc: Document, container: HTMLElement, lessons: Lesson[], boxFor: (anchor: string) => Rect | null, area: HintArea): Hints {
  const made: HTMLElement[] = [];
  const scale = area.scale ?? 1;
  const placed: Rect[] = [];
  for (const lesson of lessons) {
    const box = boxFor(lesson.anchor);
    if (!box) continue;
    const hint = doc.createElement('div');
    hint.dataset.hint = lesson.id;
    hint.textContent = lesson.text;
    hint.style.position = 'absolute';
    hint.style.pointerEvents = 'none';
    // The text keeps its theme size (set by the page style) unless the screen is scaled up.
    if (scale !== 1) hint.style.fontSize = `${Math.round(area.fontSize * scale)}px`;
    hint.style.left = '0px';
    hint.style.top = '0px';
    container.append(hint);
    const measured = hint.getBoundingClientRect();
    let size: { w: number; h: number };
    if (measured.width > 0 && measured.height > 0) {
      // Whole pixels, so that a chip placed exactly 12 px from a button is exactly 12 px from it.
      size = { w: Math.ceil(measured.width), h: Math.ceil(measured.height) };
      hint.style.boxSizing = 'border-box';
      hint.style.whiteSpace = 'nowrap';
      hint.style.width = `${size.w}px`;
      hint.style.height = `${size.h}px`;
    } else {
      size = estimateChip(lesson.text, area.fontSize * scale);
    }
    const limited = area.top !== undefined || area.bottom !== undefined || area.avoid !== undefined || area.obstacles !== undefined;
    const at = placeChip(box, size, area, placed, limited ? { top: area.top, bottom: area.bottom, avoid: area.avoid, obstacles: area.obstacles } : undefined);
    hint.style.left = `${at.x}px`;
    hint.style.top = `${at.y}px`;
    placed.push({ x: at.x, y: at.y, w: size.w, h: size.h });
    made.push(hint);
  }
  return {
    remove() {
      for (const hint of made) hint.remove();
      made.length = 0;
    },
  };
}
