import { button, paragraph } from './dom';

export interface ConfirmProps {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm(): void;
  onCancel(): void;
}

// A box with two buttons. Nothing happens until the player chooses one. Escape is the same as cancel.
export function confirmBox(doc: Document, props: ConfirmProps): HTMLElement {
  const box = doc.createElement('div');
  box.dataset.dialog = 'confirm';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', props.message);
  box.append(paragraph(doc, props.message), button(doc, 'confirm', props.confirmLabel, props.onConfirm), button(doc, 'cancel', props.cancelLabel, props.onCancel));
  box.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    props.onCancel();
  });
  return box;
}
