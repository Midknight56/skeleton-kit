import type { Lesson } from '../types';
import { button, heading, menuColumn, menuRoot } from './dom';

export interface HowProps {
  lessons: Lesson[];
  // One line for each key, such as "Space: wait".
  keys: string[];
  // Whole sentences of the game. When there are some, the list holds only these.
  howTo?: string[];
  onBack(): void;
}

export function howScreen(doc: Document, props: HowProps): HTMLElement {
  const root = menuRoot(doc, 'how');
  root.append(heading(doc, 'How to play'));
  const list = doc.createElement('ul');
  for (const text of props.howTo && props.howTo.length > 0 ? props.howTo : [...props.lessons.map((l) => l.text), ...props.keys]) {
    const li = doc.createElement('li');
    li.textContent = text;
    list.append(li);
  }
  root.append(list, menuColumn(doc, button(doc, 'back', 'Back', props.onBack)));
  return root;
}
