export function screenRoot(doc: Document, name: string): HTMLElement {
  const root = doc.createElement('main');
  root.dataset.screen = name;
  return root;
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

export function stars(doc: Document, count: number, label = 'stars'): HTMLElement {
  const el = doc.createElement('span');
  el.dataset.stars = String(count);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `${count} of 3 ${label}`);
  el.textContent = '★'.repeat(count) + '☆'.repeat(Math.max(0, 3 - count));
  return el;
}
