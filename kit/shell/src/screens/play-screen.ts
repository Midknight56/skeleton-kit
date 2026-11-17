import type { Viewport } from '@kit/core';
import { playLayout } from '../layout';
import type { InputButton } from '../types';
import { button, screenRoot } from './dom';

export interface PlayScreenProps {
  width: number;
  height: number;
  safe: Viewport['safe'];
  kind: 'turn' | 'tick';
  buttons: InputButton[];
  on: { pause(): void; undo(): void; button(action: string): void };
}

export interface PlayScreenView {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  strip: HTMLElement;
  // Publishes the values the browser tests read.
  setStatus(info: { tick: number; phase: string; hash: string }): void;
}

// Width of a strip button: 44 px at least, and room for the label plus 8 px padding on each side.
export function buttonWidth(label: string): number {
  return Math.max(44, 16 + Math.ceil(label.length * 9));
}

export function playScreen(doc: Document, props: PlayScreenProps): PlayScreenView {
  const root = screenRoot(doc, 'play');
  const items: { control: HTMLButtonElement; width: number }[] = [];
  items.push({ control: button(doc, 'pause', '❚❚', props.on.pause), width: 44 });
  items[0]!.control.setAttribute('aria-label', 'Pause');
  if (props.kind === 'turn') {
    const undo = button(doc, 'undo', '↶', props.on.undo);
    undo.setAttribute('aria-label', 'Undo');
    items.push({ control: undo, width: 44 });
  }
  if (props.kind === 'turn') {
    for (const spec of props.buttons) {
      items.push({ control: button(doc, spec.id, spec.label, () => props.on.button(spec.action)), width: buttonWidth(spec.label) });
    }
  }
  const layout = playLayout(props.width, props.height, props.safe, items.map((i) => i.width));

  const canvas = doc.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.left = `${layout.canvas.x}px`;
  canvas.style.top = `${layout.canvas.y}px`;
  canvas.style.width = `${layout.canvas.w}px`;
  canvas.style.height = `${layout.canvas.h}px`;

  const strip = doc.createElement('div');
  strip.dataset.strip = 'play';
  strip.style.position = 'absolute';
  strip.style.left = `${layout.strip.x}px`;
  strip.style.top = `${layout.strip.y}px`;
  strip.style.width = `${layout.strip.w}px`;
  strip.style.height = `${layout.strip.h}px`;

  items.forEach((item, i) => {
    const box = layout.controls[i]!;
    const s = item.control.style;
    s.position = 'absolute';
    s.left = `${box.x}px`;
    s.top = `${box.y}px`;
    s.width = `${box.w}px`;
    s.height = `${box.h}px`;
    s.padding = '0 8px';
    root.append(item.control);
  });
  root.style.width = `${props.width}px`;
  root.style.height = `${props.height}px`;
  root.prepend(canvas, strip);

  return {
    root,
    canvas,
    strip,
    setStatus(info) {
      root.dataset.tick = String(info.tick);
      root.dataset.phase = info.phase;
      root.dataset.hash = info.hash;
    },
  };
}
