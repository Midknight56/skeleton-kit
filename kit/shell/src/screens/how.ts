import type { Lesson } from '../types';
import { button, heading, screenRoot } from './dom';

export interface HowProps {
  lessons: Lesson[];
  // One line for each key, such as "Space: wait".
  keys: string[];
  onBack(): void;
}

export function howScreen(doc: Document, props: HowProps): HTMLElement {
  const root = screenRoot(doc, 'how');
  root.append(heading(doc, 'How to play'));
  const list = doc.createElement('ul');
  for (const text of [...props.lessons.map((l) => l.text), ...props.keys]) {
    const li = doc.createElement('li');
    li.textContent = text;
    list.append(li);
  }
  root.append(list, button(doc, 'back', 'Back', props.onBack));
  return root;
}
