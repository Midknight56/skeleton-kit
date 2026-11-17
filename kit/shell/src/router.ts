export type ScreenName = 'title' | 'levels' | 'play' | 'pause' | 'results' | 'settings' | 'how' | 'credits' | 'watch';
export interface Route { screen: ScreenName; params: Record<string, string> }
export interface Router {
  current(): Route;
  go(screen: ScreenName, params?: Record<string, string>): void;
  replace(screen: ScreenName, params?: Record<string, string>): void;
  onChange(listener: (route: Route) => void): void;
  destroy(): void;
}

interface HistoryState { kitRoute: Route }

function isRoute(value: unknown): value is Route {
  return typeof value === 'object' && value !== null && typeof (value as Route).screen === 'string' && typeof (value as Route).params === 'object';
}

// The router keeps the open screen in the browser history, so the back button works.
export function createRouter(win: Window, initial: ScreenName, initialParams: Record<string, string> = {}): Router {
  let route: Route = { screen: initial, params: initialParams };
  const listeners: ((route: Route) => void)[] = [];
  const state = (r: Route): HistoryState => ({ kitRoute: r });

  win.history.replaceState(state(route), '');

  const emit = () => {
    for (const listener of listeners) listener(route);
  };
  const onPop = (event: PopStateEvent) => {
    const saved = (event.state as Partial<HistoryState> | null)?.kitRoute;
    route = isRoute(saved) ? saved : { screen: initial, params: initialParams };
    emit();
  };
  win.addEventListener('popstate', onPop);

  return {
    current: () => route,
    go(screen, params = {}) {
      route = { screen, params };
      win.history.pushState(state(route), '');
      emit();
    },
    replace(screen, params = {}) {
      route = { screen, params };
      win.history.replaceState(state(route), '');
      emit();
    },
    onChange(listener) {
      listeners.push(listener);
    },
    destroy() {
      win.removeEventListener('popstate', onPop);
      listeners.length = 0;
    },
  };
}

// Calls `callback` when the window loses focus or the page becomes hidden. Returns the remove function.
export function onFocusLoss(win: Window, callback: () => void): () => void {
  const onBlur = () => callback();
  const onVisibility = () => {
    if (win.document.hidden) callback();
  };
  win.addEventListener('blur', onBlur);
  win.document.addEventListener('visibilitychange', onVisibility);
  return () => {
    win.removeEventListener('blur', onBlur);
    win.document.removeEventListener('visibilitychange', onVisibility);
  };
}
