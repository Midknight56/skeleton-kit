import type { Layer, Scene, SceneItem } from '@kit/core';

const LAYERS: Layer[] = ['back', 'world', 'actors', 'fx', 'hud'];
const MOVE_MS = 120;
const SHAKE_MS = 240;
const SHAKE_PX = 8;
const FLASH_MS = 120;
const FALLBACK_FILL = '#888888';

export interface Box { id: string; x: number; y: number; w: number; h: number }

function boxOf(item: SceneItem): Box | null {
  switch (item.kind) {
    case 'rect':
    case 'sprite':
      return { id: item.id, x: item.x, y: item.y, w: item.w, h: item.h };
    case 'circle':
      return { id: item.id, x: item.cx - item.r, y: item.cy - item.r, w: item.r * 2, h: item.r * 2 };
    case 'text':
      return null;
  }
}

// The boxes of every item that has one, in scene order, in the CSS px of the canvas.
export function sceneBoxes(scene: Scene): Box[] {
  const out: Box[] = [];
  for (const item of scene.items) {
    const box = boxOf(item);
    if (box) out.push(box);
  }
  return out;
}

// Ids of the items under a point, top item first. Skips fx, hud and text items.
export function itemIdsAt(scene: Scene, x: number, y: number): string[] {
  const hits: { id: string; layer: number; order: number }[] = [];
  scene.items.forEach((item, order) => {
    if (item.kind === 'text' || item.layer === 'fx' || item.layer === 'hud') return;
    let inside: boolean;
    if (item.kind === 'circle') {
      const dx = x - item.cx;
      const dy = y - item.cy;
      inside = dx * dx + dy * dy <= item.r * item.r;
    } else {
      inside = x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h;
    }
    if (inside) hits.push({ id: item.id, layer: LAYERS.indexOf(item.layer), order });
  });
  hits.sort((a, b) => b.layer - a.layer || b.order - a.order);
  return hits.map((h) => h.id);
}

export interface Ctx2D {
  fillStyle: string;
  globalAlpha: number;
  font: string;
  textAlign: CanvasTextAlign;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  save(): void;
  restore(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  arc(x: number, y: number, r: number, start: number, end: number): void;
  closePath(): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
  drawImage(image: CanvasImageSource, x: number, y: number, w: number, h: number): void;
}

export interface CanvasLike {
  width: number;
  height: number;
  style: { width: string; height: string };
  dataset: Record<string, string | undefined>;
  getContext(type: '2d'): Ctx2D | null;
}

export interface PainterOptions {
  devicePixelRatio: number;
  reducedMotion: () => boolean;
  // True for a turn game: an item that keeps its id glides to its new place.
  animate: boolean;
  sprite: (name: string) => CanvasImageSource | undefined;
}

export interface Painter {
  setScene(scene: Scene, now: number): void;
  paint(now: number): void;
  isMoving(now: number): boolean;
  shake(now: number): void;
  flash(now: number): void;
  isShaking(now: number): boolean;
  isFlashing(now: number): boolean;
}

interface Move { fromX: number; fromY: number; toX: number; toY: number }

function anchorOf(item: SceneItem): { x: number; y: number } {
  return item.kind === 'circle' ? { x: item.cx, y: item.cy } : { x: item.x, y: item.y };
}

function moved(item: SceneItem, x: number, y: number): SceneItem {
  return item.kind === 'circle' ? { ...item, cx: x, cy: y } : { ...item, x, y };
}

function roundedRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

export function createPainter(canvas: CanvasLike, options: PainterOptions): Painter {
  let target: Scene | null = null;
  let moves = new Map<string, Move>();
  let moveStart = 0;
  let shakeStart: number | null = null;
  let flashStart: number | null = null;

  const isMoving = (now: number): boolean => moves.size > 0 && now - moveStart < MOVE_MS;
  const isShaking = (now: number): boolean => !options.reducedMotion() && shakeStart !== null && now - shakeStart < SHAKE_MS;
  const isFlashing = (now: number): boolean => !options.reducedMotion() && flashStart !== null && now - flashStart < FLASH_MS;

  function shown(scene: Scene, now: number): SceneItem[] {
    if (!isMoving(now)) return scene.items;
    const t = Math.min(1, Math.max(0, (now - moveStart) / MOVE_MS));
    return scene.items.map((item) => {
      const move = moves.get(item.id);
      if (!move) return item;
      return moved(item, move.fromX + (move.toX - move.fromX) * t, move.fromY + (move.toY - move.fromY) * t);
    });
  }

  function drawItem(ctx: Ctx2D, item: SceneItem): void {
    ctx.globalAlpha = item.kind === 'text' ? 1 : (item.opacity ?? 1);
    switch (item.kind) {
      case 'rect':
        ctx.fillStyle = item.fill;
        if (item.radius && item.radius > 0) roundedRect(ctx, item.x, item.y, item.w, item.h, item.radius);
        else ctx.fillRect(item.x, item.y, item.w, item.h);
        break;
      case 'circle':
        ctx.fillStyle = item.fill;
        ctx.beginPath();
        ctx.arc(item.cx, item.cy, item.r, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'sprite': {
        const image = options.sprite(item.sprite);
        if (image === undefined) {
          ctx.fillStyle = FALLBACK_FILL;
          roundedRect(ctx, item.x, item.y, item.w, item.h, Math.min(item.w, item.h) / 4);
        } else if (item.flipX === true) {
          ctx.save();
          ctx.translate(item.x * 2 + item.w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(image, item.x, item.y, item.w, item.h);
          ctx.restore();
        } else {
          ctx.drawImage(image, item.x, item.y, item.w, item.h);
        }
        break;
      }
      case 'text':
        ctx.fillStyle = item.fill;
        ctx.font = `${item.size}px system-ui, sans-serif`;
        ctx.textAlign = item.align;
        ctx.fillText(item.text, item.x, item.y);
        break;
    }
  }

  return {
    setScene(scene, now) {
      const before = target;
      moves = new Map();
      if (options.animate && before) {
        const old = new Map(before.items.map((i) => [i.id, i]));
        for (const item of scene.items) {
          const was = old.get(item.id);
          if (!was) continue;
          const a = anchorOf(was);
          const b = anchorOf(item);
          if (a.x !== b.x || a.y !== b.y) moves.set(item.id, { fromX: a.x, fromY: a.y, toX: b.x, toY: b.y });
        }
        moveStart = now;
      }
      target = scene;
    },
    paint(now) {
      if (!target) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = options.devicePixelRatio;
      canvas.width = Math.round(target.width * dpr);
      canvas.height = Math.round(target.height * dpr);
      canvas.style.width = `${target.width}px`;
      canvas.style.height = `${target.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.save();
      if (isShaking(now) && shakeStart !== null) {
        const t = now - shakeStart;
        const amp = SHAKE_PX * (1 - t / SHAKE_MS);
        ctx.translate(amp * Math.sin(t / 8), amp * Math.cos(t / 11));
      }
      const items = shown(target, now);
      for (const layer of LAYERS) {
        for (const item of items) if (item.layer === layer) drawItem(ctx, item);
      }
      ctx.restore();
      if (isFlashing(now) && flashStart !== null) {
        ctx.globalAlpha = 0.5 * (1 - (now - flashStart) / FLASH_MS);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, target.width, target.height);
      }
      ctx.globalAlpha = 1;
      canvas.dataset.scene = JSON.stringify(sceneBoxes(target));
    },
    isMoving,
    shake(now) {
      shakeStart = now;
    },
    flash(now) {
      flashStart = now;
    },
    isShaking,
    isFlashing,
  };
}
