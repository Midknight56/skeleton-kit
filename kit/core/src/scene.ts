import type { Layer, Scene, SceneItem } from './types';

const LAYERS: Layer[] = ['back', 'world', 'actors', 'fx', 'hud'];

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function attrs(list: [string, string | number | undefined][]): string {
  return list
    .filter((pair): pair is [string, string | number] => pair[1] !== undefined)
    .map(([name, value]) => ` ${name}="${esc(String(value))}"`)
    .join('');
}

function paintItem(item: SceneItem, sprites: Record<string, string>): string {
  switch (item.kind) {
    case 'rect':
      return `<rect${attrs([['data-id', item.id], ['x', item.x], ['y', item.y], ['width', item.w], ['height', item.h], ['fill', item.fill], ['rx', item.radius], ['opacity', item.opacity]])}/>`;
    case 'circle':
      return `<circle${attrs([['data-id', item.id], ['cx', item.cx], ['cy', item.cy], ['r', item.r], ['fill', item.fill], ['opacity', item.opacity]])}/>`;
    case 'sprite': {
      const href = Object.prototype.hasOwnProperty.call(sprites, item.sprite) ? sprites[item.sprite] : undefined;
      if (href === undefined) {
        const open = attrs([['data-id', item.id], ['x', item.x], ['y', item.y], ['width', item.w], ['height', item.h], ['rx', Math.min(item.w, item.h) / 4], ['fill', '#888888'], ['opacity', item.opacity]]);
        return `<rect${open}><title>${esc(item.sprite)}</title></rect>`;
      }
      const transform = item.flipX === true ? `translate(${item.x * 2 + item.w} 0) scale(-1 1)` : undefined;
      return `<image${attrs([['data-id', item.id], ['href', href], ['x', item.x], ['y', item.y], ['width', item.w], ['height', item.h], ['transform', transform], ['opacity', item.opacity]])}/>`;
    }
    case 'text': {
      const anchor = item.align === 'center' ? 'middle' : item.align === 'right' ? 'end' : 'start';
      return `<text${attrs([['data-id', item.id], ['x', item.x], ['y', item.y], ['font-size', item.size], ['fill', item.fill], ['text-anchor', anchor]])}>${esc(item.text)}</text>`;
    }
  }
}

/** Paints a scene as one SVG document. Items go in layer order and then in list order. */
export function paintSvg(scene: Scene, options?: { sprites?: Record<string, string> }): string {
  const sprites = options?.sprites ?? {};
  const parts: string[] = [];
  for (const layer of LAYERS) {
    for (const item of scene.items) if (item.layer === layer) parts.push(paintItem(item, sprites));
  }
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">`;
  return `${open}${parts.join('')}</svg>`;
}

function box(item: SceneItem): { left: number; top: number; right: number; bottom: number } {
  switch (item.kind) {
    case 'rect':
    case 'sprite':
      return { left: item.x, top: item.y, right: item.x + item.w, bottom: item.y + item.h };
    case 'circle':
      return { left: item.cx - item.r, top: item.cy - item.r, right: item.cx + item.r, bottom: item.cy + item.r };
    case 'text':
      return { left: item.x, top: item.y, right: item.x, bottom: item.y };
  }
}

function negativeSize(item: SceneItem): string | null {
  switch (item.kind) {
    case 'rect':
    case 'sprite':
      return item.w < 0 || item.h < 0 ? 'width or height' : null;
    case 'circle':
      return item.r < 0 ? 'radius' : null;
    case 'text':
      return item.size < 0 ? 'font size' : null;
  }
}

/** Lists problems in a scene: repeated ids, negative sizes and items fully outside the scene. */
export function validateScene(scene: Scene): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const reported = new Set<string>();
  for (const item of scene.items) {
    if (seen.has(item.id) && !reported.has(item.id)) {
      problems.push(`The id "${item.id}" is used more than once.`);
      reported.add(item.id);
    }
    seen.add(item.id);
    const bad = negativeSize(item);
    if (bad !== null) {
      problems.push(`The item "${item.id}" has a negative ${bad}.`);
      continue;
    }
    const b = box(item);
    const isText = item.kind === 'text';
    const outside = isText
      ? b.left < 0 || b.left > scene.width || b.top < 0 || b.top > scene.height
      : b.right <= 0 || b.left >= scene.width || b.bottom <= 0 || b.top >= scene.height;
    if (outside) problems.push(`The item "${item.id}" is fully outside the scene.`);
  }
  return problems;
}
