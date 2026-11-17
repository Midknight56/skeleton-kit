import { button, heading, paragraph, screenRoot } from './dom';

export interface CreditsProps { lines: string[]; onBack(): void }

export function creditsScreen(doc: Document, props: CreditsProps): HTMLElement {
  const root = screenRoot(doc, 'credits');
  root.append(heading(doc, 'Credits'));
  for (const line of props.lines) root.append(paragraph(doc, line));
  root.append(button(doc, 'back', 'Back', props.onBack));
  return root;
}
