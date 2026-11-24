// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createRouter, onFocusLoss, type Router } from './router';

const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
let router: Router | null = null;

afterEach(() => {
  router?.destroy();
  router = null;
});

describe('router', () => {
  it('starts on the screen it is given', () => {
    router = createRouter(window, 'title');
    expect(router.current()).toEqual({ screen: 'title', params: {} });
  });

  it('go changes the screen, keeps the params and tells the listener', () => {
    router = createRouter(window, 'title');
    const seen: string[] = [];
    router.onChange((route) => seen.push(`${route.screen}:${route.params.level ?? ''}`));
    router.go('play', { level: 'lv-2' });
    expect(router.current()).toEqual({ screen: 'play', params: { level: 'lv-2' } });
    expect(seen).toEqual(['play:lv-2']);
  });

  it('settle rewrites the params of the open entry and tells no listener', () => {
    router = createRouter(window, 'title');
    router.go('play', { level: 'lv-1', fresh: '1' });
    const seen: string[] = [];
    router.onChange((route) => seen.push(route.screen));
    router.settle({ level: 'lv-1' });
    expect(router.current()).toEqual({ screen: 'play', params: { level: 'lv-1' } });
    expect(seen).toEqual([]);
    expect((window.history.state as { kitRoute: { params: unknown } }).kitRoute.params).toEqual({ level: 'lv-1' });
  });
  it('goes back with the browser history', async () => {
    router = createRouter(window, 'title');
    const seen: string[] = [];
    router.onChange((route) => seen.push(route.screen));
    router.go('levels');
    router.go('play', { level: 'lv-1' });
    window.history.back();
    await wait();
    expect(router.current().screen).toBe('levels');
    window.history.back();
    await wait();
    expect(router.current().screen).toBe('title');
    expect(seen).toEqual(['levels', 'play', 'levels', 'title']);
  });

  it('replace changes the screen without a new history entry', async () => {
    router = createRouter(window, 'title');
    router.go('levels');
    const length = window.history.length;
    router.replace('credits');
    expect(window.history.length).toBe(length);
    expect(router.current().screen).toBe('credits');
  });

  it('stops listening after destroy', async () => {
    router = createRouter(window, 'title');
    const seen: string[] = [];
    router.onChange((route) => seen.push(route.screen));
    router.destroy();
    window.history.back();
    await wait();
    expect(seen).toEqual([]);
    router = null;
  });
});

describe('onFocusLoss', () => {
  it('fires when the window loses focus', () => {
    let count = 0;
    const stop = onFocusLoss(window, () => count++);
    window.dispatchEvent(new Event('blur'));
    expect(count).toBe(1);
    stop();
  });

  it('fires when the page becomes hidden and not when it becomes visible', () => {
    let count = 0;
    const stop = onFocusLoss(window, () => count++);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(count).toBe(1);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(count).toBe(1);
    stop();
  });

  it('stops after the remove function is called', () => {
    let count = 0;
    const stop = onFocusLoss(window, () => count++);
    stop();
    window.dispatchEvent(new Event('blur'));
    expect(count).toBe(0);
  });
});
