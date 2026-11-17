import { confirmBox } from './confirm';
import { button, heading, screenRoot } from './dom';

export interface SettingsProps {
  settings: { sound: boolean; music: boolean };
  onToggle(name: 'sound' | 'music', value: boolean): void;
  onReset(): void;
  onBack(): void;
}

export function settingsScreen(doc: Document, props: SettingsProps): HTMLElement {
  const root = screenRoot(doc, 'settings');
  const values = { ...props.settings };
  root.append(heading(doc, 'Settings'));

  const toggle = (name: 'sound' | 'music', label: string) => {
    const b = button(doc, name, label, () => {
      values[name] = !values[name];
      b.setAttribute('aria-pressed', String(values[name]));
      props.onToggle(name, values[name]);
    });
    b.setAttribute('aria-pressed', String(values[name]));
    return b;
  };

  const reset = button(doc, 'reset', 'Reset progress', () => {
    if (root.querySelector('[data-dialog="confirm"]')) return;
    const box = confirmBox(doc, {
      message: 'Delete all progress?',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      onConfirm: () => {
        box.remove();
        props.onReset();
      },
      onCancel: () => box.remove(),
    });
    root.append(box);
    box.querySelector<HTMLElement>('[data-control="cancel"]')?.focus();
  });

  root.append(toggle('sound', 'Sound'), toggle('music', 'Music'), reset, button(doc, 'back', 'Back', props.onBack));
  return root;
}
