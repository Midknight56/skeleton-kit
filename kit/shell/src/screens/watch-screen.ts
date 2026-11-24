import type { Viewport } from '@kit/core';
import { playLayout, type Rect } from '../layout';
import type { InputButton } from '../types';
import { button, screenRoot } from './dom';
import { narrationRegion } from './narration';
import { buttonWidth } from './play-screen';

export interface WatchScreenProps {
  width: number;
  height: number;
  safe: Viewport['safe'];
  kind: 'turn' | 'tick';
  // The buttons of the game, shown as they are in play but not pressable.
  buttons: InputButton[];
  // The body type size of the theme, in px. It sets the width of a labelled button.
  fontSize?: number;
  // The level controls: the number of the level and whether a neighbour level with a proof is there.
  nav?: { number: number; hasPrev: boolean; hasNext: boolean };
  on: { back(): void; speed(speed: 1 | 4): void; level?(direction: -1 | 1): void };
}

export interface WatchScreenView {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  setStatus(info: { tick: number; phase: string; hash: string }): void;
  // The text version of the state for a screen reader. Null leaves the text as it is.
  setNarration(text: string | null): void;
  // The proved text or the out of date text. Null hides the line.
  setProof(text: string | null): void;
  // The pointer mark on a box of the play area or a strip control. Null hides it.
  setMark(box: Rect | null): void;
  setSpeed(speed: 1 | 4): void;
}

const PROOF_PAD = 8;
const SIDE = 16;
const NAV_HEIGHT = 44;
const NAV_GAP = 12;

export interface NavBoxes {
  prev: Rect;
  next: Rect;
  label: Rect;
  bottom: number;
}

// The level row sits at the top, 16 px from the edge: previous, the level number, next.
export function navLayout(width: number, safe: Viewport['safe'], fontSize = 16): NavBoxes {
  const w = buttonWidth('Prev', fontSize);
  const y = safe.top + SIDE;
  const left = safe.left + SIDE;
  const right = width - safe.right - SIDE;
  const prev = { x: left, y, w, h: NAV_HEIGHT };
  const next = { x: right - w, y, w, h: NAV_HEIGHT };
  const label = { x: prev.x + prev.w + NAV_GAP, y, w: Math.max(1, next.x - NAV_GAP - (prev.x + prev.w + NAV_GAP)), h: NAV_HEIGHT };
  return { prev, next, label, bottom: y + NAV_HEIGHT };
}
// The proof line sits on its own row at the top. The scene of the game is drawn below that row: its
// safe area starts at the bottom of the row, so the HUD line of the game never meets the proof line.
// A letter is taken as 0.7 em wide, as for the strip buttons, so the line count errs on the large side.
// The picture starts under the level row, 12 px from it, so no control sits over it.
export function watchCanvasTop(width: number, safe: Viewport['safe'], fontSize = 16, hasNav = false): number {
  return hasNav ? navLayout(width, safe, fontSize).bottom + NAV_GAP : 0;
}

export function watchLayout(
  width: number,
  _height: number,
  safe: Viewport['safe'],
  proofText: string | null,
  fontSize = 16,
  hasNav = false,
): { proof: Rect | null; lineHeight: number; sceneSafe: Viewport['safe'] } {
  const lineHeight = Math.ceil(fontSize * 1.3);
  // With the level row, everything else starts under it.
  const top = hasNav ? navLayout(width, safe, fontSize).bottom : safe.top;
  if (proofText === null) return { proof: null, lineHeight, sceneSafe: hasNav ? { ...safe, top: top + PROOF_PAD } : { ...safe } };
  const left = safe.left + SIDE;
  const w = Math.max(1, width - safe.right - SIDE - left);
  const lines = Math.max(1, Math.ceil((proofText.length * fontSize * 0.7) / w));
  const proof = { x: left, y: top + PROOF_PAD, w, h: lines * lineHeight };
  return { proof, lineHeight, sceneSafe: { ...safe, top: proof.y + proof.h + PROOF_PAD } };
}

export function watchScreen(doc: Document, props: WatchScreenProps): WatchScreenView {
  const root = screenRoot(doc, 'watch');
  const speed1 = button(doc, 'speed-1', '1x', () => props.on.speed(1));
  const speed4 = button(doc, 'speed-4', '4x', () => props.on.speed(4));
  const back = button(doc, 'back', 'Back', props.on.back);
  const controls: { el: HTMLButtonElement; width: number }[] = [
    { el: speed1, width: 44 },
    { el: speed4, width: 44 },
    { el: back, width: buttonWidth('Back', props.fontSize) },
  ];
  if (props.kind === 'turn') {
    for (const spec of props.buttons) {
      const shown = button(doc, spec.id, spec.label, () => undefined);
      shown.disabled = true;
      controls.push({ el: shown, width: buttonWidth(spec.label, props.fontSize) });
    }
  }
  const layout = playLayout(props.width, props.height, props.safe, controls.map((c) => c.width));
  const nav = props.nav ? navLayout(props.width, props.safe, props.fontSize) : null;

  const canvas = doc.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.left = `${layout.canvas.x}px`;
  const canvasTop = watchCanvasTop(props.width, props.safe, props.fontSize, props.nav !== undefined);
  canvas.style.top = `${layout.canvas.y + canvasTop}px`;
  canvas.style.width = `${layout.canvas.w}px`;
  canvas.style.height = `${layout.canvas.h - canvasTop}px`;
  canvas.style.pointerEvents = 'none';

  const proof = doc.createElement('p');
  proof.dataset.proof = 'line';
  proof.hidden = true;
  proof.style.cssText = `position:absolute;margin:0;text-align:center;pointer-events:none;font-size:${props.fontSize ?? 16}px`;

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
  if (nav && props.nav) {
    const place = (el: HTMLElement, box: Rect) => {
      el.style.position = 'absolute';
      el.style.left = `${box.x}px`;
      el.style.top = `${box.y}px`;
      el.style.width = `${box.w}px`;
      el.style.height = `${box.h}px`;
    };
    const prev = button(doc, 'level-prev', 'Prev', () => props.on.level?.(-1));
    prev.setAttribute('aria-label', 'Previous level');
    prev.disabled = !props.nav.hasPrev;
    const next = button(doc, 'level-next', 'Next', () => props.on.level?.(1));
    next.setAttribute('aria-label', 'Next level');
    next.disabled = !props.nav.hasNext;
    for (const [el, box] of [[prev, nav.prev], [next, nav.next]] as const) {
      place(el, box);
      el.style.padding = '0 8px';
      root.append(el);
    }
    const label = doc.createElement('p');
    label.dataset.watchLevel = '';
    label.textContent = `Level ${props.nav.number}`;
    place(label, nav.label);
    label.style.cssText += `;margin:0;text-align:center;line-height:${nav.label.h}px;pointer-events:none;font-size:${props.fontSize ?? 16}px`;
    root.append(label);
  }
  const narration = narrationRegion(doc);
  root.append(narration.el);

  const setSpeed = (n: 1 | 4) => {
    speed1.setAttribute('aria-pressed', String(n === 1));
    speed4.setAttribute('aria-pressed', String(n === 4));
  };
  setSpeed(1);

  return {
    root,
    canvas,
    setNarration: narration.say,
    setStatus(info) {
      root.dataset.tick = String(info.tick);
      root.dataset.phase = info.phase;
      root.dataset.hash = info.hash;
    },
    setProof(text) {
      proof.hidden = text === null;
      proof.textContent = text ?? '';
      const box = watchLayout(props.width, props.height, props.safe, text, props.fontSize, props.nav !== undefined);
      if (box.proof) {
        proof.style.left = `${box.proof.x}px`;
        proof.style.top = `${box.proof.y}px`;
        proof.style.width = `${box.proof.w}px`;
        proof.style.lineHeight = `${box.lineHeight}px`;
      }
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
