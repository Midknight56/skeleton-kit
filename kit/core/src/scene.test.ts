import { describe, expect, it } from 'vitest';
import { paintSvg, validateScene } from './scene';
import type { Scene, SceneItem } from './types';

type Node = { name: string; attrs: Record<string, string>; children: Node[]; text: string };

function unescape(text: string): string {
  return text.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}

// A tiny XML parser. It throws on anything that is not well formed, including a raw `<` or `&` in text or an attribute.
function parseXml(source: string): Node {
  const root: Node = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: Node[] = [root];
  const token = /<\/([A-Za-z][\w-]*)>|<([A-Za-z][\w-]*)((?:\s+[\w:-]+="[^"<&]*(?:&(?:amp|lt|gt|quot);[^"<&]*)*")*)\s*(\/?)>|([^<]+)/gy;
  let pos = 0;
  while (pos < source.length) {
    token.lastIndex = pos;
    const m = token.exec(source);
    if (m === null) throw new Error(`not well formed near: ${source.slice(pos, pos + 40)}`);
    pos = token.lastIndex;
    const top = stack[stack.length - 1] as Node;
    if (m[1] !== undefined) {
      if (stack.length < 2 || top.name !== m[1]) throw new Error(`unexpected </${m[1]}>`);
      stack.pop();
    } else if (m[2] !== undefined) {
      const attrs: Record<string, string> = {};
      for (const a of (m[3] ?? '').matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1] as string] = unescape(a[2] as string);
      const node: Node = { name: m[2], attrs, children: [], text: '' };
      top.children.push(node);
      if (m[4] !== '/') stack.push(node);
    } else {
      const raw = m[5] as string;
      if (/&(?!(?:amp|lt|gt|quot);)/.test(raw)) throw new Error('raw & in text');
      top.text += unescape(raw);
    }
  }
  if (stack.length !== 1) throw new Error('unclosed element');
  if (root.children.length !== 1) throw new Error('need exactly one root');
  return root.children[0] as Node;
}

const rect = (id: string, layer: SceneItem['layer'], extra: Partial<Extract<SceneItem, { kind: 'rect' }>> = {}): SceneItem => ({
  kind: 'rect', id, layer, x: 1, y: 1, w: 5, h: 5, fill: '#fff', ...extra,
});

describe('paintSvg', () => {
  it('returns one svg document with the scene size', () => {
    const svg = paintSvg({ width: 100, height: 50, items: [] });
    const root = parseXml(svg);
    expect(root.name).toBe('svg');
    expect(root.attrs.width).toBe('100');
    expect(root.attrs.height).toBe('50');
    expect(root.attrs.viewBox).toBe('0 0 100 50');
    expect(root.attrs.xmlns).toBe('http://www.w3.org/2000/svg');
  });

  it('draws items in layer order and then in list order', () => {
    const scene: Scene = {
      width: 100,
      height: 100,
      items: [rect('hud1', 'hud'), rect('back1', 'back'), rect('act1', 'actors'), rect('w1', 'world'), rect('fx1', 'fx'), rect('w2', 'world'), rect('back2', 'back')],
    };
    const ids = parseXml(paintSvg(scene)).children.map((n) => n.attrs['data-id']);
    expect(ids).toEqual(['back1', 'back2', 'w1', 'w2', 'act1', 'fx1', 'hud1']);
  });

  it('writes one element for each item, with the right element name and numbers', () => {
    const scene: Scene = {
      width: 100,
      height: 100,
      items: [
        rect('r', 'world', { radius: 3, opacity: 0.5 }),
        { kind: 'circle', id: 'c', layer: 'world', cx: 10, cy: 20, r: 4, fill: '#0f0' },
        { kind: 'text', id: 't', layer: 'hud', x: 5, y: 9, text: 'hello', size: 12, fill: '#000', align: 'center' },
      ],
    };
    const [r, c, t] = parseXml(paintSvg(scene)).children as [Node, Node, Node];
    expect(r.name).toBe('rect');
    expect(r.attrs).toMatchObject({ x: '1', y: '1', width: '5', height: '5', fill: '#fff', rx: '3', opacity: '0.5' });
    expect(c.name).toBe('circle');
    expect(c.attrs).toMatchObject({ cx: '10', cy: '20', r: '4', fill: '#0f0' });
    expect(t.name).toBe('text');
    expect(t.text).toBe('hello');
    expect(t.attrs).toMatchObject({ x: '5', y: '9', 'font-size': '12', fill: '#000', 'text-anchor': 'middle' });
  });

  it('maps left and right alignment to text-anchor', () => {
    const mk = (align: 'left' | 'right'): SceneItem => ({ kind: 'text', id: align, layer: 'hud', x: 0, y: 0, text: 'a', size: 1, fill: '#000', align });
    const [l, r] = parseXml(paintSvg({ width: 9, height: 9, items: [mk('left'), mk('right')] })).children as [Node, Node];
    expect(l.attrs['text-anchor']).toBe('start');
    expect(r.attrs['text-anchor']).toBe('end');
  });

  it('draws a rounded rectangle with a title for a sprite with no map entry', () => {
    const scene: Scene = {
      width: 100,
      height: 100,
      items: [{ kind: 'sprite', id: 's', layer: 'actors', x: 10, y: 20, w: 8, h: 6, sprite: 'hero' }],
    };
    const variants: ({ sprites?: Record<string, string> } | undefined)[] = [undefined, { sprites: {} }, { sprites: { other: 'x.png' } }];
    for (const options of variants) {
      const [s] = parseXml(paintSvg(scene, options)).children as [Node];
      expect(s.name).toBe('rect');
      expect(s.attrs).toMatchObject({ x: '10', y: '20', width: '8', height: '6' });
      expect(Number(s.attrs.rx)).toBeGreaterThan(0);
      expect(s.children).toHaveLength(1);
      expect(s.children[0]?.name).toBe('title');
      expect(s.children[0]?.text).toBe('hero');
    }
  });

  it('draws an image for a sprite that has a map entry, and mirrors it for flipX', () => {
    const scene: Scene = {
      width: 100,
      height: 100,
      items: [
        { kind: 'sprite', id: 's', layer: 'actors', x: 10, y: 20, w: 8, h: 6, sprite: 'hero' },
        { kind: 'sprite', id: 'f', layer: 'actors', x: 10, y: 20, w: 8, h: 6, sprite: 'hero', flipX: true },
      ],
    };
    const [s, f] = parseXml(paintSvg(scene, { sprites: { hero: 'data:image/png;base64,AAA' } })).children as [Node, Node];
    expect(s.name).toBe('image');
    expect(s.attrs).toMatchObject({ href: 'data:image/png;base64,AAA', x: '10', y: '20', width: '8', height: '6' });
    expect(s.attrs.transform).toBeUndefined();
    expect(f.attrs.transform).toBe('translate(28 0) scale(-1 1)');
  });

  it('escapes & < > and " in text, ids, fills, sprite names and sprite map values', () => {
    const evil = 'a<b & "c">';
    const scene: Scene = {
      width: 100,
      height: 100,
      items: [
        { kind: 'text', id: evil, layer: 'hud', x: 1, y: 1, text: evil, size: 10, fill: evil, align: 'left' },
        { kind: 'sprite', id: 's1', layer: 'world', x: 1, y: 1, w: 4, h: 4, sprite: evil },
        { kind: 'sprite', id: 's2', layer: 'world', x: 1, y: 1, w: 4, h: 4, sprite: 'm' },
      ],
    };
    const svg = paintSvg(scene, { sprites: { m: evil } });
    expect(svg).toContain('a&lt;b &amp; &quot;c&quot;&gt;');
    const kids = parseXml(svg).children;
    const text = kids.find((n) => n.name === 'text') as Node;
    expect(text.text).toBe(evil);
    expect(text.attrs['data-id']).toBe(evil);
    expect(text.attrs.fill).toBe(evil);
    expect(kids.find((n) => n.name === 'rect')?.children[0]?.text).toBe(evil);
    expect(kids.find((n) => n.name === 'image')?.attrs.href).toBe(evil);
  });

  it('escapes the plain text a<b & "c" exactly', () => {
    const svg = paintSvg({ width: 9, height: 9, items: [{ kind: 'text', id: 't', layer: 'hud', x: 0, y: 0, text: 'a<b & "c"', size: 1, fill: '#000', align: 'left' }] });
    expect(svg).toContain('>a&lt;b &amp; &quot;c&quot;</text>');
  });
});

describe('validateScene', () => {
  it('returns no problem for a good scene', () => {
    const scene: Scene = { width: 10, height: 10, items: [rect('a', 'back'), { kind: 'circle', id: 'b', layer: 'world', cx: 5, cy: 5, r: 2, fill: '#000' }] };
    expect(validateScene(scene)).toEqual([]);
  });

  it('names a repeated id', () => {
    const problems = validateScene({ width: 10, height: 10, items: [rect('a', 'back'), rect('a', 'world')] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"a"');
    expect(problems[0]).toContain('more than once');
  });

  it('names a negative size for each kind', () => {
    const items: SceneItem[] = [
      rect('w', 'back', { w: -1 }),
      rect('h', 'back', { h: -2 }),
      { kind: 'circle', id: 'r', layer: 'world', cx: 5, cy: 5, r: -3, fill: '#000' },
      { kind: 'sprite', id: 'sw', layer: 'world', x: 1, y: 1, w: -1, h: 2, sprite: 's' },
      { kind: 'text', id: 'ts', layer: 'hud', x: 1, y: 1, text: 'a', size: -4, fill: '#000', align: 'left' },
    ];
    const problems = validateScene({ width: 10, height: 10, items });
    for (const id of ['w', 'h', 'r', 'sw', 'ts']) {
      expect(problems.some((p) => p.includes(`"${id}"`) && p.includes('negative'))).toBe(true);
    }
  });

  it('names an item that is fully outside the scene', () => {
    const items: SceneItem[] = [
      rect('left', 'back', { x: -10, w: 5 }),
      rect('right', 'back', { x: 10, w: 5 }),
      rect('above', 'back', { y: -6, h: 5 }),
      rect('below', 'back', { y: 11 }),
      { kind: 'circle', id: 'far', layer: 'world', cx: 50, cy: 5, r: 2, fill: '#000' },
      { kind: 'text', id: 'gone', layer: 'hud', x: 5, y: -1, text: 'a', size: 4, fill: '#000', align: 'left' },
    ];
    const problems = validateScene({ width: 10, height: 10, items });
    for (const id of ['left', 'right', 'above', 'below', 'far', 'gone']) {
      expect(problems.some((p) => p.includes(`"${id}"`) && p.includes('outside'))).toBe(true);
    }
  });

  it('accepts an item that is partly outside', () => {
    const items: SceneItem[] = [rect('a', 'back', { x: -2, w: 5 }), { kind: 'circle', id: 'c', layer: 'world', cx: 11, cy: 5, r: 2, fill: '#000' }];
    expect(validateScene({ width: 10, height: 10, items })).toEqual([]);
  });
});
