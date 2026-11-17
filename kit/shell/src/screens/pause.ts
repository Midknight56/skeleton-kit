import { confirmBox } from './confirm';
import { button, heading, screenRoot } from './dom';

export interface PauseProps { onResume(): void; onRetry(): void; onLevels(): void }

// Retry and Levels throw the run away, so each asks first. Resume does not.
export function pauseScreen(doc: Document, props: PauseProps): HTMLElement {
  const root = screenRoot(doc, 'pause');

  const askFirst = (id: string, label: string, action: () => void) => {
    const opener = button(doc, id, label, () => {
      if (root.querySelector('[data-dialog="confirm"]')) return;
      const close = () => {
        box.remove();
        opener.focus();
      };
      const box = confirmBox(doc, {
        message: 'Leave this run?',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        onConfirm: () => {
          box.remove();
          action();
        },
        onCancel: close,
      });
      root.append(box);
      box.querySelector<HTMLElement>('[data-control="cancel"]')?.focus();
    });
    return opener;
  };

  root.append(
    heading(doc, 'Paused'),
    button(doc, 'resume', 'Resume', props.onResume),
    askFirst('retry', 'Retry', props.onRetry),
    askFirst('levels', 'Levels', props.onLevels),
  );
  return root;
}
