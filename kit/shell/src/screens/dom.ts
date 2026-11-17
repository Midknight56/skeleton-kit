export function screenRoot(doc: Document, name: string): HTMLElement {
  const root = doc.createElement('main');
  root.dataset.screen = name;
  return root;
}

// The root of a menu screen. It is the card: the heading and the controls are one block in it, and
// the page style centres the card in the screen.
export function menuRoot(doc: Document, name: string): HTMLElement {
  const root = screenRoot(doc, name);
  root.dataset.card = '';
  return root;
}

// The buttons of a menu in one column. The page style gives every button the width of the widest one.
export function menuColumn(doc: Document, ...buttons: HTMLElement[]): HTMLElement {
  const column = doc.createElement('div');
  column.dataset.column = '';
  column.append(...buttons);
  return column;
}

export function heading(doc: Document, text: string): HTMLElement {
  const h = doc.createElement('h1');
  h.textContent = text;
  return h;
}

export function paragraph(doc: Document, text: string): HTMLElement {
  const p = doc.createElement('p');
  p.textContent = text;
  return p;
}

// A real button, so it gets keyboard focus and a name from the browser.
export function button(doc: Document, id: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = doc.createElement('button');
  b.type = 'button';
  b.dataset.control = id;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

// A real link that is styled and placed like a button. It opens in the same tab.
export function link(doc: Document, id: string, label: string, href: string): HTMLAnchorElement {
  const a = doc.createElement('a');
  a.dataset.control = id;
  a.href = href;
  a.textContent = label;
  return a;
}

export function stars(doc: Document, count: number, label = 'stars'): HTMLElement {
  const el = doc.createElement('span');
  el.dataset.stars = String(count);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `${count} of 3 ${label}`);
  el.textContent = '★'.repeat(count) + '☆'.repeat(Math.max(0, 3 - count));
  return el;
}
