import { button, heading, paragraph, screenRoot, stars } from './dom';

export interface ResultsProps {
  won: boolean;
  // status.reason of the end state.
  reason: string | undefined;
  reasons: Record<string, string>;
  stars: number;
  hasNext: boolean;
  on: { next(): void; retry(): void; levels(): void };
}

export function resultsScreen(doc: Document, props: ResultsProps): HTMLElement {
  const root = screenRoot(doc, 'results');
  root.dataset.phase = props.won ? 'won' : 'lost';
  root.append(heading(doc, props.won ? 'Done' : 'Lost'));
  if (props.reason !== undefined) {
    const text = Object.prototype.hasOwnProperty.call(props.reasons, props.reason) ? props.reasons[props.reason]! : props.reason;
    const line = paragraph(doc, text);
    line.dataset.reason = props.reason;
    root.append(line);
  }
  if (props.won) root.append(stars(doc, props.stars));
  if (props.won && props.hasNext) root.append(button(doc, 'next', 'Next', props.on.next));
  root.append(button(doc, 'retry', 'Retry', props.on.retry), button(doc, 'levels', 'Levels', props.on.levels));
  return root;
}
