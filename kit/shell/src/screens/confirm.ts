import { button, menuColumn, paragraph } from './dom';

export interface ConfirmProps {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  // The control that opened the box. Focus goes back to it when the box is cancelled.
  opener?: HTMLElement;
  onConfirm(): void;
  onCancel(): void;
}

// A box with two buttons. Nothing happens until the player chooses one. Escape is the same as cancel.
// Tab and Shift+Tab move between the two buttons only, so focus never reaches the screen behind the box.
export function confirmBox(doc: Document, props: ConfirmProps): HTMLElement {
  const box = doc.createElement('div');
  box.dataset.dialog = 'confirm';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', props.message);
  const cancel = () => {
    props.onCancel();
    props.opener?.focus();
  };
  const card = doc.createElement('div');
  card.dataset.card = '';
  card.append(paragraph(doc, props.message), menuColumn(doc, button(doc, 'confirm', props.confirmLabel, props.onConfirm), button(doc, 'cancel', props.cancelLabel, cancel)));
  box.append(card);
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      const buttons = Array.from(box.querySelectorAll<HTMLElement>('button'));
      const at = buttons.indexOf(doc.activeElement as HTMLElement);
      const next = at < 0 ? (e.shiftKey ? buttons.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
      return;
    }
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    cancel();
  });
  return box;
}
