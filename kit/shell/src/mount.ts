import type { GameDef, Json, Scene, Viewport } from '@kit/core';
import { createAudio } from './audio';
import { createBeacon } from './beacon';
import { lessonsToShow, showHints, type Hints } from './lessons';
import type { Rect } from './layout';
import { createPainter, sceneBoxes, type CanvasLike, type Painter } from './painter';
import { createPlay, type PlayController } from './play';
import { createRouter, onFocusLoss, type Route } from './router';
import { creditsScreen } from './screens/credits';
import { howScreen } from './screens/how';
import { levelLocks, levelsScreen } from './screens/levels';
import { pauseScreen } from './screens/pause';
import { playScreen } from './screens/play-screen';
import { resultsScreen } from './screens/results';
import { settingsScreen } from './screens/settings';
import { titleScreen } from './screens/title';
import { watchScreen, type WatchScreenView } from './screens/watch-screen';
import { parseWatchParam, createWatch } from './watch';
import { starsFor, finishLevel } from './stars';
import { createStore, type ProgressStore } from './storage';
import { themeCss } from './styles';
import type { Theme } from './theme';
import type { GameTexts, InputMap, ProofFile, ProofIndex, ProofSet } from './types';

export interface MountOptions<S extends Json, A> {
  def: GameDef<S, A>;
  theme: Theme;
  input: InputMap<S>;
  proofs: ProofSet;
  texts: GameTexts<S>;
  credits: string[];
  // The search text of the page address, such as "?watch=g03". Nothing is read from the page itself.
  search?: string;
}

interface ActivePlay<S extends Json, A> {
  levelId: string;
  levelIndex: number;
  play: PlayController<S, A>;
  start: S;
  score: number;
  result: { won: boolean; reason: string | undefined; stars: number } | null;
}

const WIN_FLASH_MS = 120;
const LOSE_SHAKE_MS = 240;

function readSafe(doc: Document): Viewport['safe'] {
  const win = doc.defaultView;
  const probe = doc.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  doc.body.append(probe);
  const style = win?.getComputedStyle(probe);
  const num = (v: string | undefined) => Number.parseFloat(v ?? '') || 0;
  const safe = { top: num(style?.paddingTop), right: num(style?.paddingRight), bottom: num(style?.paddingBottom), left: num(style?.paddingLeft) };
  probe.remove();
  return safe;
}

function openStorage(win: Window): Storage | null {
  try {
    return win.localStorage;
  } catch {
    return null;
  }
}

export function mountGame<S extends Json, A>(element: HTMLElement, options: MountOptions<S, A>): { destroy(): void } {
  if (!options || !options.theme) {
    throw new Error('mountGame needs a theme. The kit has no default theme.');
  }
  const { def, theme, input, proofs, texts } = options;
  const doc = element.ownerDocument;
  const win = doc.defaultView as Window;
  const store: ProgressStore = createStore(def.id, openStorage(win));
  const audio = createAudio({ theme, store });
  const beacon = createBeacon({ game: def.id });
  const levels = def.levels();

  const style = doc.createElement('style');
  style.textContent = themeCss(theme);
  const container = doc.createElement('div');
  container.dataset.kitRoot = def.id;
  element.append(style, container);

  let proofIndex: ProofIndex | null = null;
  let destroyed = false;
  let noticeShown = false;
  // True while the visit to the title screen that showed the notice goes on, so a redraw keeps it.
  let noticeOnTitle = false;
  let active: ActivePlay<S, A> | null = null;
  let stopLoop: (() => void) | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  // The theme names each sprite by a url inside the app. Images load once, at mount.
  const images = new Map<string, HTMLImageElement>();
  for (const [name, url] of Object.entries(theme.sprites)) {
    const image = doc.createElement('img');
    image.src = url;
    images.set(name, image);
  }

  proofs.loadIndex().then(
    (index) => {
      if (destroyed) return;
      proofIndex = index;
      if (router.current().screen === 'title') render(router.current());
    },
    () => {
      proofIndex = null;
    },
  );

  const router = createRouter(win, 'title');
  const watchAtStart = parseWatchParam(options.search ?? '', levels);
  if (watchAtStart) router.replace('watch', { level: watchAtStart });
  const reducedMotion = () => win.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  function later(ms: number, fn: () => void): void {
    const handle = setTimeout(() => {
      timers.delete(handle);
      if (!destroyed) fn();
    }, ms);
    timers.add(handle);
  }

  function show(node: HTMLElement, focusFirst: boolean): void {
    container.replaceChildren(node);
    if (focusFirst) node.querySelector<HTMLElement>('[data-control]')?.focus();
  }

  function leavePlay(): void {
    stopLoop?.();
    stopLoop = null;
  }

  function firstOpenLevel(): string {
    const locks = levelLocks(levels, (id) => store.isFinished(id));
    const idx = levels.findIndex((l, i) => locks[i] === false && !store.isFinished(l.id));
    return (levels[idx >= 0 ? idx : 0] as { id: string }).id;
  }

  function startPlay(levelId: string): void {
    const levelIndex = levels.findIndex((l) => l.id === levelId);
    const win2 = win;
    const W = win2.innerWidth;
    const H = win2.innerHeight;
    const safe = readSafe(doc);
    const view = playScreen(doc, {
      width: W,
      height: H,
      safe,
      kind: def.kind,
      buttons: input.buttons,
      fontSize: theme.typeScale.body,
      on: {
        pause: () => router.go('pause'),
        undo: () => {
          if (active?.play.undo()) audio.play('tap');
        },
        button: (action) => {
          active?.play.press(action);
        },
      },
    });
    const canvasHeight = H - 72 - safe.bottom;
    const viewport: Viewport = { width: W, height: canvasHeight, safe: { top: safe.top, right: safe.right, bottom: 0, left: safe.left } };
    let hints: Hints | null = null;
    let painter: Painter;

    if (!active || active.levelId !== levelId || active.result !== null) {
      const current: { value: ActivePlay<S, A> | null } = { value: null };
      const play = createPlay({
        def,
        input,
        levelId,
        viewport,
        onApplied: () => {
          hints?.remove();
          hints = null;
          const a = current.value;
          if (!a) return;
          const score = a.play.session.status().score;
          if (def.kind === 'turn') audio.play('move');
          else if (score > a.score) {
            audio.play('pickup');
            painter.flash(performance.now());
          }
          a.score = score;
        },
        onPhase: (status) => {
          const a = current.value;
          if (!a) return;
          const won = status.phase === 'won';
          const session = a.play.session;
          let stars = 0;
          if (won) {
            const par = proofIndex?.levels.find((l) => l.id === levelId)?.actions;
            stars = starsFor({ kind: def.kind, texts, start: a.start, end: session.state, actions: session.tick, par });
            finishLevel(store, def.kind, levelId, stars, def.kind === 'turn' ? session.tick : status.score);
          }
          a.result = { won, reason: status.reason, stars };
          beacon.send('level_end', { level: levelId, result: won ? 'won' : 'lost' });
          const now = performance.now();
          if (won) painter.flash(now);
          else painter.shake(now);
          later(reducedMotion() ? 0 : won ? WIN_FLASH_MS : LOSE_SHAKE_MS, () => {
            audio.play(won ? 'win' : 'lose');
            router.go('results', { level: levelId });
          });
        },
      });
      const fresh: ActivePlay<S, A> = { levelId, levelIndex, play, start: play.session.state, score: 0, result: null };
      current.value = fresh;
      active = fresh;
      hints = null;
      beacon.send('level_start', { level: levelId });
      const shown = lessonsToShow(store, input.lessons, levelIndex === 0);
      painter = makePainter(view);
      painter.setScene(play.scene(), 0);
      hints = showHints(doc, view.root, shown, (anchor) => boxForAnchor(view.root, play.scene(), anchor), { width: W, height: H, safe, fontSize: theme.typeScale.small });
    } else {
      active.play.setViewport(viewport);
      painter = makePainter(view);
      painter.setScene(active.play.scene(), 0);
    }
    const current = active;
    show(view.root, false);

    let lastTick = -1;
    let last = -1;
    let raf = 0;
    const frame = (ts: number) => {
      const t = Math.round(ts);
      const dt = last < 0 ? 0 : Math.min(t - last, 1000);
      last = t;
      if (def.kind === 'tick') current.play.frame(dt);
      if (current.play.session.tick !== lastTick) {
        lastTick = current.play.session.tick;
        painter.setScene(current.play.scene(), t);
      }
      painter.paint(t);
      view.setStatus({ tick: current.play.session.tick, phase: current.play.session.status().phase, hash: current.play.session.hash() });
      raf = win.requestAnimationFrame(frame);
    };
    raf = win.requestAnimationFrame(frame);

    const onPointer = (e: PointerEvent) => {
      const rect = view.canvas.getBoundingClientRect();
      current.play.pointer(e.clientX - rect.left, e.clientY - rect.top);
    };
    view.canvas.addEventListener('pointerdown', onPointer);
    stopLoop = () => {
      win.cancelAnimationFrame(raf);
      view.canvas.removeEventListener('pointerdown', onPointer);
    };
  }

  function makePainter(view: { canvas: HTMLCanvasElement }): Painter {
    return createPainter(view.canvas as unknown as CanvasLike, {
      devicePixelRatio: win.devicePixelRatio || 1,
      reducedMotion,
      animate: def.kind === 'turn',
      sprite: (name) => {
        const image = images.get(name);
        return image && image.complete && image.naturalWidth > 0 ? image : undefined;
      },
    });
  }

  function boxForAnchor(root: HTMLElement, scene: Scene, anchor: string): Rect | null {
    const item = sceneBoxes(scene).find((b) => b.id === anchor);
    if (item) return { x: item.x, y: item.y, w: item.w, h: item.h };
    const control = root.querySelector<HTMLElement>(`[data-control="${anchor}"]`);
    if (!control) return null;
    return { x: parseFloat(control.style.left), y: parseFloat(control.style.top), w: parseFloat(control.style.width), h: parseFloat(control.style.height) };
  }

  function startWatch(proof: ProofFile): void {
    const W = win.innerWidth;
    const H = win.innerHeight;
    const safe = readSafe(doc);
    const watch = createWatch({ def, input, texts, proof });
    beacon.send('watch_start', { level: proof.level });
    const view: WatchScreenView = watchScreen(doc, {
      width: W,
      height: H,
      safe,
      kind: def.kind,
      buttons: input.buttons,
      fontSize: theme.typeScale.body,
      on: {
        back: () => router.go('title'),
        speed: (n) => {
          watch.setSpeed(n);
          view.setSpeed(n);
        },
      },
    });
    const viewport: Viewport = { width: W, height: H - 72 - safe.bottom, safe: { top: safe.top, right: safe.right, bottom: 0, left: safe.left } };
    const painter = makePainter(view);
    const verdict = watch.verdict;
    view.setProof(verdict.kind === 'unproved' ? null : verdict.text);
    show(view.root, false);

    let last = -1;
    let seenTick = -1;
    let seenRestarts = -1;
    let raf = 0;
    const frame = (ts: number) => {
      const t = Math.round(ts);
      const dt = last < 0 ? 0 : Math.min(t - last, 1000);
      last = t;
      watch.frame(dt);
      if (watch.session.tick !== seenTick || watch.restarts() !== seenRestarts) {
        seenTick = watch.session.tick;
        seenRestarts = watch.restarts();
        painter.setScene(def.view(watch.session.state, viewport), t);
      }
      painter.paint(t);
      const mark = watch.mark();
      view.setMark(mark && mark.anchor ? boxForAnchor(view.root, def.view(watch.session.state, viewport), mark.anchor) : null);
      view.setStatus({ tick: watch.session.tick, phase: watch.session.status().phase, hash: watch.session.hash() });
      raf = win.requestAnimationFrame(frame);
    };
    raf = win.requestAnimationFrame(frame);
    stopLoop = () => win.cancelAnimationFrame(raf);
  }

  function nextLevelId(levelId: string): string | null {
    const i = levels.findIndex((l) => l.id === levelId);
    return levels[i + 1]?.id ?? null;
  }

  function render(route: Route): void {
    leavePlay();
    if (route.screen !== 'title') noticeOnTitle = false;
    switch (route.screen) {
      case 'title': {
        const showNotice = !store.persistent && (!noticeShown || noticeOnTitle);
        if (showNotice) noticeShown = true;
        noticeOnTitle = showNotice;
        show(
          titleScreen(doc, {
            title: def.title,
            showNotice,
            on: {
              play: () => router.go('play', { level: firstOpenLevel(), fresh: '1' }),
              levels: () => router.go('levels'),
              how: () => router.go('how'),
              settings: () => router.go('settings'),
              credits: () => router.go('credits'),
              ...(proofIndex && proofIndex.levels.length > 0
                ? { watch: () => router.go('watch', { level: (proofIndex?.levels[0] as { id: string }).id }) }
                : {}),
            },
          }),
          true,
        );
        return;
      }
      case 'levels':
        show(
          levelsScreen(doc, {
            levels,
            stars: (id) => store.read().levels[id]?.stars ?? 0,
            onPick: (id) => router.go('play', { level: id, fresh: '1' }),
            onBack: () => router.go('title'),
          }),
          true,
        );
        return;
      case 'play': {
        const levelId = route.params.level ?? '';
        if (!levels.some((l) => l.id === levelId)) {
          router.replace('title');
          return;
        }
        if (route.params.fresh === '1') active = null;
        startPlay(levelId);
        return;
      }
      case 'pause': {
        const levelId = active?.levelId ?? '';
        show(
          pauseScreen(doc, {
            onResume: () => router.go('play', { level: levelId }),
            onRetry: () => router.go('play', { level: levelId, fresh: '1' }),
            onLevels: () => router.go('levels'),
          }),
          true,
        );
        return;
      }
      case 'results': {
        const result = active?.result;
        const levelId = route.params.level ?? active?.levelId ?? '';
        if (!result) {
          router.replace('title');
          return;
        }
        const next = nextLevelId(levelId);
        show(
          resultsScreen(doc, {
            won: result.won,
            reason: result.reason,
            reasons: texts.reasons,
            stars: result.stars,
            hasNext: next !== null,
            on: {
              next: () => next && router.go('play', { level: next, fresh: '1' }),
              retry: () => router.go('play', { level: levelId, fresh: '1' }),
              levels: () => router.go('levels'),
            },
          }),
          true,
        );
        return;
      }
      case 'settings':
        show(
          settingsScreen(doc, {
            settings: store.read().settings,
            onToggle: (name, value) => (name === 'sound' ? audio.setSound(value) : audio.setMusic(value)),
            onReset: () => {
              store.reset();
              active = null;
              render(router.current());
            },
            onBack: () => router.go('title'),
          }),
          true,
        );
        return;
      case 'how':
        show(howScreen(doc, { lessons: input.lessons, keys: input.keys ?? [], onBack: () => router.go('title') }), true);
        return;
      case 'credits':
        show(creditsScreen(doc, { lines: options.credits, onBack: () => router.go('title') }), true);
        return;
      case 'watch': {
        const levelId = route.params.level ?? '';
        if (!levels.some((l) => l.id === levelId)) {
          router.replace('title');
          return;
        }
        container.replaceChildren();
        proofs.load(levelId).then(
          (proof) => {
            const now = router.current();
            if (destroyed || now.screen !== 'watch' || now.params.level !== levelId) return;
            startWatch(proof);
          },
          () => {
            if (!destroyed && router.current().screen === 'watch') router.replace('title');
          },
        );
        return;
      }
    }
  }

  router.onChange(render);

  const onKey = (e: KeyboardEvent) => {
    if (router.current().screen !== 'play' || !active) return;
    if (e.key === 'Escape') {
      router.go('pause');
      return;
    }
    const focused = doc.activeElement?.tagName === 'BUTTON';
    if (active.play.key(e.key, focused)) e.preventDefault();
  };
  const onFirstInput = () => audio.unlock();
  const onTap = (e: Event) => {
    if ((e.target as Element | null)?.closest?.('[data-control]')) audio.play('tap');
  };
  win.addEventListener('keydown', onKey);
  win.addEventListener('keydown', onFirstInput);
  win.addEventListener('pointerdown', onFirstInput);
  container.addEventListener('click', onTap);
  const stopFocusLoss = onFocusLoss(win, () => {
    if (router.current().screen === 'play' && active && active.result === null) router.go('pause');
  });

  beacon.send('open');
  render(router.current());

  return {
    destroy() {
      destroyed = true;
      leavePlay();
      for (const t of timers) clearTimeout(t);
      timers.clear();
      stopFocusLoss();
      win.removeEventListener('keydown', onKey);
      win.removeEventListener('keydown', onFirstInput);
      win.removeEventListener('pointerdown', onFirstInput);
      container.removeEventListener('click', onTap);
      router.destroy();
      audio.stopMusic();
      style.remove();
      container.remove();
      active = null;
    },
  };
}
