// The page side of the level edit comparison (see level-compare.ts). It reads the grid box and a chosen
// file in this page, paints two boards and writes plain text. It makes no request and writes no storage.
import { paintSvg, type Json, type Viewport } from '@kit/core';
import { gardenTheme } from '../apps/garden/theme';
import {
  EXAMPLE_ROWS,
  LIMITS,
  compare,
  exportFile,
  importFile,
  levelDef,
  parseGridText,
  routeFor,
  shippedLevel,
  type Comparison,
  type Frame,
  type Level,
} from './level-compare';

const VIEWPORT: Viewport = { width: 400, height: 300, safe: { top: 0, right: 0, bottom: 0, left: 0 } };

interface Model {
  original: Level;
  seed: number;
  route: string[];
  result: Comparison | null;
  editedLevel: Level | null;
  /** Id, title and turn limit of the edited copy. Only its rows come from the grid box. */
  editedMeta: Level;
  step: number;
}

function paint(level: Level, frame: Frame): string {
  // The state comes from a real session of this level, so the board is the one the rules use.
  const def = levelDef(level);
  return paintSvg(def.view(frame.state as Json, VIEWPORT), { sprites: gardenTheme.sprites });
}

function q<T extends HTMLElement>(root: ParentNode, name: string): T {
  const found = root.querySelector<T>(`[data-compare="${name}"]`);
  if (!found) throw new Error(`The page has no element for "${name}".`);
  return found;
}

function item(text: string): HTMLLIElement {
  const li = document.createElement('li');
  li.textContent = text;
  return li;
}

export function setupCompare(): void {
  const root = document.querySelector<HTMLElement>('[data-compare="root"]');
  if (!root) return;
  const grid = q<HTMLTextAreaElement>(root, 'grid');
  const error = q(root, 'error');
  const status = q(root, 'status');
  const original = shippedLevel();
  const model: Model = { original, seed: 1, route: routeFor(original, 1) ?? [], result: null, editedLevel: null, editedMeta: { ...original, rows: [...original.rows] }, step: 0 };
  const originalGrid = q(root, 'original-grid');
  originalGrid.textContent = original.rows.join('\n');
  grid.value = original.rows.join('\n');

  const say = (text: string): void => {
    status.textContent = text;
  };
  const fail = (problems: string[] | null): void => {
    error.textContent = problems === null ? '' : problems.join(' ');
    grid.setAttribute('aria-invalid', String(problems !== null));
  };

  const showStep = (): void => {
    const result = model.result;
    if (!result || !model.editedLevel) return;
    const last = result.original.length - 1;
    model.step = Math.max(0, Math.min(last, model.step));
    q(root, 'edited-grid').textContent = model.editedLevel.rows.join('\n');
    const left = result.original[model.step]!;
    const right = result.edited[model.step]!;
    for (const [side, frame, level] of [
      ['original', left, model.original],
      ['edited', right, model.editedLevel],
    ] as const) {
      const scene = q(root, `${side}-scene`);
      scene.innerHTML = paint(level, frame);
      scene.setAttribute('role', 'img');
      scene.setAttribute('aria-label', `${side === 'original' ? 'Original' : 'Edited'} board. ${frame.text}`);
      q(root, `${side}-text`).textContent = frame.text;
      q(root, `${side}-squares`).replaceChildren(...frame.squares.map(item));
    }
    q(root, 'step-label').textContent = model.step === 0 ? `Start board, before any move (${last} moves)` : `Move ${model.step} of ${last}: ${left.action}`;
    q<HTMLButtonElement>(root, 'prev').disabled = model.step === 0;
    q<HTMLButtonElement>(root, 'next').disabled = model.step === last;
    Array.from(q(root, 'table').querySelectorAll('tbody tr')).forEach((row, i) => {
      (row as HTMLElement).dataset.current = String(i + 1 === model.step);
    });
  };

  const showResult = (result: Comparison): void => {
    q(root, 'route').textContent = result.route;
    q(root, 'first').textContent = result.difference ? result.difference.text : 'No move changes its outcome.';
    q(root, 'first').dataset.changed = String(result.changed);
    q(root, 'search').textContent = `Search of the edited board, a separate check of all routes: ${result.search.text}`;
    q(root, 'search').dataset.kind = result.search.kind;
    const body = q(root, 'table').querySelector('tbody')!;
    body.replaceChildren(
      ...result.original.slice(1).map((frame, i) => {
        const other = result.edited[i + 1]!;
        const tr = document.createElement('tr');
        const same = frame.phase === other.phase && frame.moths.every((m, k) => JSON.stringify(m) === JSON.stringify(other.moths[k]));
        const cells = [`${frame.turn}`, frame.action ?? '', frame.text, other.text, same ? 'same' : 'different'];
        for (const text of cells) {
          const td = document.createElement('td');
          td.textContent = text;
          tr.append(td);
        }
        tr.dataset.same = String(same);
        return tr;
      }),
    );
    model.step = result.difference ? result.difference.turn : result.original.length - 1;
    showStep();
  };

  const run = (level: Level): void => {
    model.editedLevel = level;
    model.result = compare(model.original, level, model.seed, model.route);
    showResult(model.result);
    say(
      model.result.changed
        ? `Compared. The first changed outcome is on turn ${model.result.difference!.turn}.`
        : 'Compared. Every move of the saved route has the same outcome on both boards.',
    );
  };

  const compareFromBox = (): void => {
    const parsed = parseGridText(grid.value, model.editedMeta);
    if (!parsed.ok) {
      fail(parsed.problems);
      say('The grid has problems. Nothing was compared.');
      return;
    }
    fail(null);
    run(parsed.level);
  };

  q<HTMLFormElement>(root, 'form').addEventListener('submit', (event) => {
    event.preventDefault();
    compareFromBox();
  });
  q(root, 'example').addEventListener('click', () => {
    grid.value = EXAMPLE_ROWS.join('\n');
    compareFromBox();
  });
  q(root, 'restore').addEventListener('click', () => {
    model.editedMeta = { ...model.original, rows: [...model.original.rows] };
    grid.value = model.original.rows.join('\n');
    compareFromBox();
    const result = model.result;
    if (result) {
      const end = result.edited[result.edited.length - 1]!;
      const won = result.original[result.original.length - 1]!.phase === 'won' && end.phase === 'won';
      say(
        `Restored the whole original level (title, turn limit and rows). ${
          won ? `The saved route wins again on turn ${end.turn}.` : 'The saved route does not win on the restored copy.'
        }`,
      );
    }
  });
  q(root, 'prev').addEventListener('click', () => {
    model.step -= 1;
    showStep();
  });
  q(root, 'next').addEventListener('click', () => {
    model.step += 1;
    showStep();
  });
  q(root, 'start').addEventListener('click', () => {
    model.step = 0;
    showStep();
  });

  const exportLink = q<HTMLButtonElement>(root, 'export');
  exportLink.addEventListener('click', () => {
    const parsed = parseGridText(grid.value, model.editedMeta);
    if (!parsed.ok) {
      fail(parsed.problems);
      say('The grid has problems. Nothing was exported.');
      return;
    }
    fail(null);
    const text = exportFile(model.original, parsed.level, model.seed, model.route);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'level-compare.json';
    a.click();
    URL.revokeObjectURL(url);
    say(`Exported level-compare.json (${new TextEncoder().encode(text).length} bytes). It holds both levels, the seed and the moves.`);
  });

  q<HTMLInputElement>(root, 'import').addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > LIMITS.maxFileBytes) {
      fail([`The file has ${file.size} bytes, and the most allowed is ${LIMITS.maxFileBytes}.`]);
      say('The file was not read.');
      return;
    }
    void file.text().then((text) => {
      const parsed = importFile(text);
      if (!parsed.ok) {
        fail(parsed.problems);
        say('The file was not used.');
        return;
      }
      fail(null);
      model.original = parsed.file.original;
      model.seed = parsed.file.seed;
      model.route = parsed.file.actions;
      model.editedMeta = { ...parsed.file.edited, rows: [...parsed.file.edited.rows] };
      originalGrid.textContent = model.original.rows.join('\n');
      grid.value = parsed.file.edited.rows.join('\n');
      run(parsed.file.edited);
      say(`Imported ${file.name}. The moves were played again on both boards. ${model.result!.changed ? `The first changed outcome is on turn ${model.result!.difference!.turn}.` : 'No outcome changed.'}`);
    });
  });

  run({ ...original, rows: [...original.rows] });
  say('Ready. The edited copy starts equal to the original.');
}
