import type { Viewport } from '@kit/core';
import { playLayout, type Rect } from '../layout';
import type { InputButton } from '../types';
import { button, screenRoot } from './dom';
import { buttonWidth } from './play-screen';

export interface WatchScreenProps {
  width: number;
  height: number;
  safe: Viewport['safe'];
  kind: 'turn' | 'tick';
  // The buttons of the game, shown as they are in play but not pressable.
  buttons: InputButton[];
  on: { back(): void; speed(speed: 1 | 4): void };
}

export interface WatchScreenView {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  setStatus(info: { tick: number; phase: string; hash: string }): void;
  // The proved text or the out of date text. Null hides the line.
  setProof(text: string | null): void;
  // The pointer mark on a box of the play area or a strip control. Null hides it.
  setMark(box: Rect | null): void;
  setSpeed(speed: 1 | 4): void;
}

export function watchScreen(doc: Document, props: WatchScreenProps): WatchScreenView {
  const root = screenRoot(doc, 'watch');
  const speed1 = button(doc, 'speed-1', '1x', () => props.on.speed(1));
  const speed4 = button(doc, 'speed-4', '4x', () => props.on.speed(4));
  const back = button(doc, 'back', 'Back', props.on.back);
  const controls: { el: HTMLButtonElement; width: number }[] = [
    { el: speed1, width: 44 },
    { el: speed4, width: 44 },
    { el: back, width: buttonWidth('Back') },
  ];
  if (props.kind === 'turn') {
    for (const spec of props.buttons) {
      const shown = button(doc, spec.id, spec.label, () => undefined);
      shown.disabled = true;
      controls.push({ el: shown, width: buttonWidth(spec.label) });
    }
  }
  const layout = playLayout(props.width, props.height, props.safe, controls.map((c) => c.width));

  const canvas = doc.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.left = `${layout.canvas.x}px`;
  canvas.style.top = `${layout.canvas.y}px`;
  canvas.style.width = `${layout.canvas.w}px`;
  canvas.style.height = `${layout.canvas.h}px`;
  canvas.style.pointerEvents = 'none';

  const proof = doc.createElement('p');
  proof.dataset.proof = 'line';
  proof.hidden = true;
  proof.style.cssText = `position:absolute;left:0;top:${props.safe.top + 8}px;width:${props.width}px;margin:0;text-align:center;pointer-events:none`;

  const mark = doc.createElement('div');
  mark.dataset.pointerMark = 'on';
  mark.hidden = true;
  mark.style.cssText = 'position:absolute;width:28px;height:28px;margin:-14px 0 0 -14px;border:3px solid #ffffff;border-radius:50%;box-sizing:border-box;pointer-events:none';

  controls.forEach((c, i) => {
    const box = layout.controls[i]!;
    const s = c.el.style;
    s.position = 'absolute';
    s.left = `${box.x}px`;
    s.top = `${box.y}px`;
    s.width = `${box.w}px`;
    s.height = `${box.h}px`;
    s.padding = '0 8px';
    root.append(c.el);
  });
  root.style.width = `${props.width}px`;
  root.style.height = `${props.height}px`;
  root.prepend(canvas);
  root.append(proof, mark);

  const setSpeed = (n: 1 | 4) => {
    speed1.setAttribute('aria-pressed', String(n === 1));
    speed4.setAttribute('aria-pressed', String(n === 4));
  };
  setSpeed(1);

  return {
    root,
    canvas,
    setStatus(info) {
      root.dataset.tick = String(info.tick);
      root.dataset.phase = info.phase;
      root.dataset.hash = info.hash;
    },
    setProof(text) {
      proof.hidden = text === null;
      proof.textContent = text ?? '';
    },
    setMark(box) {
      mark.hidden = box === null;
      if (box) {
        mark.style.left = `${box.x + box.w / 2}px`;
        mark.style.top = `${box.y + box.h / 2}px`;
      }
    },
    setSpeed,
  };
}
