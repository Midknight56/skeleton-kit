import { button, heading, menuColumn, menuRoot, paragraph } from './dom';

export interface TitleProps {
  title: string;
  // True once, when storage is blocked.
  showNotice: boolean;
  // `watch` is given only when a proof for a level has loaded.
  on: { play(): void; levels(): void; how(): void; settings(): void; credits(): void; watch?(): void };
}

export function titleScreen(doc: Document, props: TitleProps): HTMLElement {
  const root = menuRoot(doc, 'title');
  root.append(heading(doc, props.title));
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
  return root;
}
