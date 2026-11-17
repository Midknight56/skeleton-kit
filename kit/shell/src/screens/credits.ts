import { button, heading, menuColumn, menuRoot, paragraph } from './dom';

export interface CreditsProps { lines: string[]; onBack(): void }

export function creditsScreen(doc: Document, props: CreditsProps): HTMLElement {
  const root = menuRoot(doc, 'credits');
  root.append(heading(doc, 'Credits'));
  for (const line of props.lines) root.append(paragraph(doc, line));
  root.append(menuColumn(doc, button(doc, 'back', 'Back', props.onBack)));
  return root;
}
