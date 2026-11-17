import { button, heading, screenRoot } from './dom';

export interface PauseProps { onResume(): void; onRetry(): void; onLevels(): void }

export function pauseScreen(doc: Document, props: PauseProps): HTMLElement {
  const root = screenRoot(doc, 'pause');
  root.append(
    heading(doc, 'Paused'),
    button(doc, 'resume', 'Resume', props.onResume),
    button(doc, 'retry', 'Retry', props.onRetry),
    button(doc, 'levels', 'Levels', props.onLevels),
  );
  return root;
}
