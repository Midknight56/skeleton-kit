import { confirmBox } from './confirm';
import { button, heading, link, menuColumn, menuRoot } from './dom';

export type SettingName = 'sound' | 'music' | 'usage';

export interface SettingsProps {
  settings: { sound: boolean; music: boolean; usage: boolean };
  onToggle(name: SettingName, value: boolean): void;
  onReset(): void;
  onBack(): void;
}

// Where the privacy page sits, seen from a game page such as /garden/.
export const PRIVACY_HREF = '../privacy/';

export function settingsScreen(doc: Document, props: SettingsProps): HTMLElement {
  const root = menuRoot(doc, 'settings');
  const values = { ...props.settings };
  root.append(heading(doc, 'Settings'));

  const toggle = (name: SettingName, label: string) => {
    const b = button(doc, name, label, () => {
      values[name] = !values[name];
      b.setAttribute('aria-pressed', String(values[name]));
      props.onToggle(name, values[name]);
    });
    b.setAttribute('aria-pressed', String(values[name]));
    // The page style writes "on" or "off" after the name of a switch.
    b.dataset.switch = '';
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

  root.append(
    menuColumn(
      doc,
      toggle('sound', 'Sound'),
      toggle('music', 'Music'),
      toggle('usage', 'Usage data'),
      link(doc, 'privacy', 'Privacy', PRIVACY_HREF),
      reset,
      button(doc, 'back', 'Back', props.onBack),
    ),
  );
  return root;
}
