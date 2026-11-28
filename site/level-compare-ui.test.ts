// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { setupCompare } from './level-compare-ui';
import { EXAMPLE_ROWS, exportFile, importFile, routeFor, shippedLevel } from './level-compare';

// Spec level-edit-compare. The page module is played with real click events on the real section of index.html.
const html = readFileSync(join(process.cwd(), 'site', 'index.html'), 'utf8');
const section = /<section class="compare"[\s\S]*?<\/section>/.exec(html)![0];
const el = (name: string): HTMLElement => document.querySelector<HTMLElement>(`[data-compare="${name}"]`)!;
const click = (name: string): void => el(name).click();

describe('level compare page', () => {
  beforeEach(() => {
    document.body.innerHTML = section;
    setupCompare();
  });

  it('keeps the table readable on a phone: minimum widths, and scrolling only inside its container', () => {
    expect(html).toMatch(/\.cmp-table \{[^}]*min-width: 640px/);
    expect(html).toMatch(/\.cmp-scroll \{[^}]*max-width: 100%[^}]*overflow-x: auto/);
    expect(html).toMatch(/td:nth-child\(3\)[^{]*td:nth-child\(4\)[^{]*\{ min-width: 200px/);
  });

  it('starts equal and links from the intro', () => {
    expect(html).toContain('href="#compare"');
    expect(el('first').textContent).toBe('No move changes its outcome.');
    expect((el('grid') as HTMLTextAreaElement).value).toBe('2f1..\nm..#.\n.f...');
  });

  it('the example names the first changed turn in text and then restore shows the win holds', () => {
    click('example');
    expect(el('first').textContent).toContain('On turn 2 (wait)');
    expect(el('route').textContent).toContain('does not say whether another route wins');
    expect(el('edited-squares').textContent).toContain('flower');
    expect(el('status').textContent).toContain('turn 2');
    expect(document.querySelectorAll('[data-compare="table"] tbody tr')).toHaveLength(2);
    click('restore');
    expect(el('first').textContent).toBe('No move changes its outcome.');
    expect(el('status').textContent).toContain('wins again');
  });

  it('steps through the moves and stays inside the range', () => {
    click('example');
    click('start');
    expect((el('prev') as HTMLButtonElement).disabled).toBe(true);
    click('next');
    click('next');
    expect((el('next') as HTMLButtonElement).disabled).toBe(true);
    expect(el('edited-text').textContent).toContain('Turn 2');
    expect(el('original-text').textContent).toContain('The level is won');
  });

  it('shows an inline problem for a bad grid and keeps the last comparison', () => {
    click('example');
    (el('grid') as HTMLTextAreaElement).value = '2f1..\nm..#x\n.f...';
    click('run');
    expect(el('error').textContent).toContain('Row 2, column 5');
    expect(el('grid').getAttribute('aria-invalid')).toBe('true');
    expect(el('first').textContent).toContain('On turn 2');
    (el('grid') as HTMLTextAreaElement).value = '2f1..\nm..#.\n.f...';
    click('run');
    expect(el('error').textContent).toBe('');
  });
});

describe('level compare import and export in the page', () => {
  const base = shippedLevel();
  const original = { ...base, maxTurns: 6 };
  const edited = { ...base, title: 'Short copy', maxTurns: 1, rows: EXAMPLE_ROWS };
  const route = routeFor(original, 1)!;
  const downloads: Blob[] = [];

  beforeEach(() => {
    downloads.length = 0;
    URL.createObjectURL = (blob: Blob | MediaSource): string => {
      downloads.push(blob as Blob);
      return 'blob:test';
    };
    URL.revokeObjectURL = (): void => undefined;
    HTMLAnchorElement.prototype.click = (): void => undefined;
  });

  const importText = async (text: string): Promise<void> => {
    const input = el('import') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [{ name: 'saved.json', size: text.length, text: () => Promise.resolve(text) }], configurable: true });
    input.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const exported = async (): Promise<ReturnType<typeof importFile>> => {
    click('export');
    const blob = downloads[downloads.length - 1]!;
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    return importFile(text);
  };

  it('keeps the edited title and turn limit through import, compare and export, and restore resets them', async () => {
    await importText(exportFile(original, edited, 1, route));
    expect(el('error').textContent).toBe('');
    expect(el('edited-text').textContent).toContain('of 1');

    for (const step of ['export', 'run'] as const) {
      if (step === 'run') click('run');
      const back = await exported();
      expect(back.ok).toBe(true);
      if (back.ok) {
        expect(back.file.edited.title).toBe('Short copy');
        expect(back.file.edited.maxTurns).toBe(1);
        expect(back.file.original.maxTurns).toBe(6);
        expect(back.file.original.title).toBe(base.title);
      }
    }

    click('restore');
    expect(el('status').textContent).toContain('whole original level');
    const restored = await exported();
    expect(restored.ok && restored.file.edited.title).toBe(base.title);
    expect(restored.ok && restored.file.edited.maxTurns).toBe(6);
  });

  it('shows a reason for a file whose route is empty, never wins or is refused, and changes nothing', async () => {
    for (const [moves, reason] of [
      [[], 'no moves'],
      [['light:1'], 'does not win'],
      [['light:5', 'wait'], 'is refused'],
    ] as const) {
      await importText(exportFile(original, edited, 1, [...moves]));
      expect(el('error').textContent).toContain(reason);
      expect(el('status').textContent).toBe('The file was not used.');
      expect(el('grid').getAttribute('aria-invalid')).toBe('true');
    }
    expect((el('grid') as HTMLTextAreaElement).value).toBe('2f1..\nm..#.\n.f...');
  });

  it('says the saved route wins again only from the actual result', async () => {
    click('example');
    click('restore');
    expect(el('status').textContent).toContain('wins again on turn 2');
  });
});
