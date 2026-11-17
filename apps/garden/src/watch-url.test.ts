// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import def from './def';

const mountGame = vi.hoisted(() => vi.fn(() => ({ destroy: () => undefined })));
vi.mock('@kit/shell', () => ({ mountGame }));

describe('the watch address of the garden puzzle', () => {
  beforeEach(() => {
    mountGame.mockClear();
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('has g03 as a level, so that ?watch=g03 can start watch mode', () => {
    expect(def.levels().map((l) => l.id)).toContain('g03');
  });

  it('hands the search text of the page address to mountGame', async () => {
    window.history.replaceState(null, '', '/garden/?watch=g03');
    await import('./main');
    expect(mountGame).toHaveBeenCalledTimes(1);
    const options = (mountGame.mock.calls[0] as unknown as [HTMLElement, { search?: string }])[1];
    expect(options.search).toBe('?watch=g03');
  });

  it('hands an empty search text when the address has none', async () => {
    window.history.replaceState(null, '', '/garden/');
    await import('./main');
    const options = (mountGame.mock.calls[0] as unknown as [HTMLElement, { search?: string }])[1];
    expect(options.search ?? '').toBe('');
  });
});
