import { button, heading, menuColumn, menuRoot, paragraph } from './dom';

export interface GarlandProps {
  // The SVG of one level, lit (finished) and unlit. They come from the theme.
  lit: string;
  unlit: string;
  // One entry for each level: true when the level is finished.
  finished: boolean[];
}

export interface TitleProps {
  title: string;
  // One short line under the title.
  tagline?: string;
  // True once, when storage is blocked.
  showNotice: boolean;
  // A picture of the levels on a wire. It holds no control.
  garland?: GarlandProps;
  // `watch` is given only when a proof for a level has loaded.
  on: { play(): void; levels(): void; how(): void; settings(): void; credits(): void; watch?(): void };
}

function garlandPicture(doc: Document, props: GarlandProps): HTMLElement {
  const el = doc.createElement('div');
  el.setAttribute('data-garland', '');
  el.setAttribute('aria-hidden', 'true');
  const wire = doc.createElement('div');
  wire.className = 'wire';
  const row = doc.createElement('div');
  row.className = 'row';
  const next = props.finished.findIndex((done) => !done);
  props.finished.forEach((done, i) => {
    const item = doc.createElement('div');
    item.setAttribute('data-garland-item', '');
    item.dataset.lit = String(done);
    item.dataset.ring = String(i === next);
    item.style.setProperty('--i', String(i));
    const picture = doc.createElement('span');
    picture.className = 'picture';
    picture.innerHTML = done ? props.lit : props.unlit;
    const number = doc.createElement('span');
    number.className = 'number';
    number.textContent = String(i + 1);
    item.append(picture, number);
    row.append(item);
  });
  const note = doc.createElement('small');
  note.className = 'note';
  const total = props.finished.length;
  note.textContent = next >= 0 ? `next: level ${next + 1} of ${total}` : `all ${total} levels done`;
  el.append(wire, row, note);
  return el;
}

export function titleScreen(doc: Document, props: TitleProps): HTMLElement {
  const root = menuRoot(doc, 'title');
  if (props.garland && props.garland.finished.length > 0) root.setAttribute('data-garland-below', '');
  root.append(heading(doc, props.title));
  if (props.tagline) {
    const line = paragraph(doc, props.tagline);
    line.dataset.tagline = '';
    root.append(line);
  }
  if (props.showNotice) {
    const notice = paragraph(doc, 'Progress will not be saved.');
    notice.dataset.notice = 'storage';
    root.append(notice);
  }
  const column = menuColumn(doc, button(doc, 'play', 'Play', props.on.play));
  if (props.on.watch) column.append(button(doc, 'watch', 'Watch', props.on.watch));
  column.append(
    button(doc, 'levels', 'Levels', props.on.levels),
    button(doc, 'how', 'How to play', props.on.how),
    button(doc, 'settings', 'Settings', props.on.settings),
    button(doc, 'credits', 'Credits', props.on.credits),
  );
  root.append(column);
  if (props.garland && props.garland.finished.length > 0) root.append(garlandPicture(doc, props.garland));
  return root;
}
