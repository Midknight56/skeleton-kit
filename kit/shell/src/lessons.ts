import type { Rect } from './layout';
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

// Puts one hint box beside the box of each lesson anchor. A hint takes no pointer events.
// A lesson whose anchor has no box is skipped.
export function showHints(doc: Document, container: HTMLElement, lessons: Lesson[], boxFor: (anchor: string) => Rect | null): Hints {
  const made: HTMLElement[] = [];
  for (const lesson of lessons) {
    const box = boxFor(lesson.anchor);
    if (!box) continue;
    const hint = doc.createElement('div');
    hint.dataset.hint = lesson.id;
    hint.textContent = lesson.text;
    hint.style.position = 'absolute';
    hint.style.pointerEvents = 'none';
    hint.style.left = `${box.x}px`;
    hint.style.top = `${Math.max(0, box.y - 32)}px`;
    container.append(hint);
    made.push(hint);
  }
  return {
    remove() {
      for (const hint of made) hint.remove();
      made.length = 0;
    },
  };
}
