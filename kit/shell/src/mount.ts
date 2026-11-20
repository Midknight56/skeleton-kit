import type { GameDef, Json, Scene, Viewport } from '@kit/core';
import { expandActions } from '@kit/core';
import { createAudio } from './audio';
import { createBeacon } from './beacon';
import { createBackdrop } from './screens/backdrop';
import type { EffectFactory } from './effects';
import { watchMessage } from './watch-message';
import { lessonsToShow, showHints, type Hints } from './lessons';
import { stripHeight, uiScale, type Rect } from './layout';
import type { Lesson } from './types';
import { createPainter, hudTextBoxes, sceneBoxes, type CanvasLike, type Painter } from './painter';
import { createPlay, type PlayController } from './play';
import { createRouter, onFocusLoss, type Route } from './router';
import { creditsScreen } from './screens/credits';
import { howScreen } from './screens/how';
import { readLevelFacts } from './level-facts';
import { levelLocks, levelsScreen } from './screens/levels';
import { pauseScreen } from './screens/pause';
import { playScreen } from './screens/play-screen';
import { resultsScreen } from './screens/results';
import { settingsScreen } from './screens/settings';
import { titleScreen } from './screens/title';
import { watchLayout, watchScreen, type WatchScreenView } from './screens/watch-screen';
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
  // One short line under the title on the title screen.
  tagline?: string;
  // The search text of the page address, such as "?watch=g03". Nothing is read from the page itself.
  search?: string;
  // Optional effects of the game. They only draw, so the rules, the state and the replays do not change.
  effects?: EffectFactory;
}

interface ActivePlay<S extends Json, A> {
  levelId: string;
  levelIndex: number;
  play: PlayController<S, A>;
  start: S;
  score: number;
  result: { won: boolean; reason: string | undefined; stars: number } | null;
  // True once a level_end was sent for this start, so a start never gets two.
  ended: boolean;
}

const WIN_FLASH_MS = 120;
// The old menu card lifts out in this time.
const LIFT_OUT_MS = 300;
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
  const beacon = createBeacon({ game: def.id, enabled: () => store.read().settings.usage });
  const levels = def.levels();
  const levelFacts = readLevelFacts(doc);
  doc.title = def.title;

  const style = doc.createElement('style');
  style.textContent = themeCss(theme);
  const container = doc.createElement('div');
  container.dataset.kitRoot = def.id;
  element.append(style, container);
  const backdrop = createBackdrop(doc, theme);
  backdrop.setLook('menu');

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

  function liftGhost(card: HTMLElement): HTMLElement {
    const rect = card.getBoundingClientRect();
    const style = win.getComputedStyle(card);
    const ghost = doc.createElement('div');
    ghost.setAttribute('data-lift', '');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border-radius:${style.borderRadius};border-color:${style.borderColor}`;
    // The two strings run from the top of the page to the card.
    for (const side of ['left', 'right']) {
      const string = doc.createElement('i');
      string.dataset.side = side;
      string.style.height = `${Math.max(0, rect.top)}px`;
      ghost.append(string);
    }
    return ghost;
  }

  function show(node: HTMLElement, focusFirst: boolean): void {
    const name = node.dataset.screen;
    const leaving = container.querySelector<HTMLElement>('[data-screen][data-card]');
    // The card that leaves lifts out as a hollow outline. It holds no text and no control, so the page
    // never has two screens, and a test can click the new screen at once.
    const ghost = leaving && leaving.dataset.screen !== 'title' && leaving.dataset.screen !== name && !reducedMotion() ? liftGhost(leaving) : null;
    backdrop.setLook(name === 'title' ? 'title' : name === 'play' || name === 'watch' ? 'play' : 'menu');
    container.replaceChildren(backdrop.sky, backdrop.rail, node);
    if (ghost) {
      container.append(ghost);
      later(LIFT_OUT_MS, () => ghost.remove());
    }
    backdrop.keepClear(node);
    // The page shows a loading screen until the first screen of the game is drawn.
    doc.querySelector('[data-screen="loading"]')?.remove();
    if (focusFirst) node.querySelector<HTMLElement>('[data-control]')?.focus();
  }

  function leavePlay(): void {
    stopLoop?.();
    stopLoop = null;
  }

  function endLevel(a: ActivePlay<S, A>, result: 'won' | 'lost' | 'left'): void {
    if (a.ended) return;
    a.ended = true;
    beacon.send('level_end', { level: a.levelId, result });
  }

  // A level that is not won or lost is left when the next screen is neither its pause screen nor its
  // own play screen going on. That covers Retry, Levels and the browser back button.
  function leaveLevelFor(route: Route): void {
    const a = active;
    if (!a || a.ended) return;
    const goesOn = route.screen === 'pause' || (route.screen === 'play' && route.params.level === a.levelId && route.params.fresh !== '1');
    if (!goesOn) endLevel(a, 'left');
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
    const scale = uiScale(W, H);
    const view = playScreen(doc, {
      width: W,
      height: H,
      safe,
      kind: def.kind,
      buttons: input.buttons,
      fontSize: theme.typeScale.body,
      scale,
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
    const canvasHeight = H - stripHeight(scale, safe.bottom);
    const viewport: Viewport = { width: W, height: canvasHeight, safe: { top: safe.top, right: safe.right, bottom: 0, left: safe.left } };
    let hints: Hints | null = null;
    let shown: Lesson[] = [];
    let painter: Painter;

    if (!active || active.levelId !== levelId || active.result !== null) {
      const current: { value: ActivePlay<S, A> | null } = { value: null };
      const play = createPlay({
        def,
        input,
        levelId,
        viewport,
        hudScale: scale,
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
          endLevel(a, won ? 'won' : 'lost');
          const now = performance.now();
          if (won) painter.flash(now);
          else painter.shake(now);
          // A game with effects says how long its win flourish or crash burst needs before the results screen.
          const hold = painter.hold();
          later(reducedMotion() ? 0 : hold ? (won ? hold.won : hold.lost) : won ? WIN_FLASH_MS : LOSE_SHAKE_MS, () => {
            audio.play(won ? 'win' : 'lose');
            router.go('results', { level: levelId });
          });
        },
      });
      const fresh: ActivePlay<S, A> = { levelId, levelIndex, play, start: play.session.state, score: 0, result: null, ended: false };
      current.value = fresh;
      active = fresh;
      hints = null;
      beacon.send('level_start', { level: levelId });
      shown = lessonsToShow(store, input.lessons, levelIndex === 0);
      painter = makePainter(view);
      painter.setScene(play.scene(), 0);
    } else {
      active.play.setViewport(viewport);
      painter = makePainter(view);
      painter.setScene(active.play.scene(), 0);
    }
    const current = active;
    show(view.root, false);
    // The chips are measured and placed once the screen is shown, because a hidden page has no layout.
    if (shown.length > 0) {
      // Chips stay below the counter text and above the strip, 12 px from the text and the buttons.
      const hud = hudTextBoxes(current.play.scene());
      const buttons = Array.from(view.root.querySelectorAll<HTMLElement>('[data-control]')).map((el) => ({
        x: parseFloat(el.style.left),
        y: parseFloat(el.style.top),
        w: parseFloat(el.style.width),
        h: parseFloat(el.style.height),
      }));
      hints = showHints(doc, view.root, shown, (anchor) => boxForAnchor(view.root, current.play.scene(), anchor), {
        width: W,
        height: H,
        safe,
        fontSize: theme.typeScale.small,
        scale,
        top: Math.max(0, ...hud.map((b) => b.y + b.h)),
        bottom: parseFloat(view.strip.style.top),
        avoid: [...hud, ...buttons],
        obstacles: sceneBoxes(current.play.scene()).map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })),
      });
    }

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
      ...(options.effects ? { effects: options.effects() } : {}),
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
    const verdict = watch.verdict;
    const proofText = verdict.kind === 'unproved' ? null : verdict.text;
    const rows = watchLayout(W, H, safe, proofText, theme.typeScale.body);
    const viewport: Viewport = { width: W, height: H - 72 - safe.bottom, safe: { top: rows.sceneSafe.top, right: safe.right, bottom: 0, left: safe.left } };
    const painter = makePainter(view);
    view.setProof(proofText);
    show(view.root, false);

    let last = -1;
    let seenTick = -1;
    let seenRestarts = -1;
    let raf = 0;
    // A page that holds this one in a frame hears how far the run is. The message goes to the same
    // origin only and holds the numbers of the run, nothing of the state.
    const expanded = expandActions(proof.replay.actions);
    const total = expanded.ok ? expanded.actions.length : 0;
    const tellParent = (applied: number, round: number): void => {
      if (win.parent === win || win.location.origin === 'null') return;
      win.parent.postMessage(watchMessage(proof.level, applied, total, round), win.location.origin);
    };
    // One watch_end for each watch_start: at the first end of the replay, or when the screen is left.
    let watchEnded = false;
    const endWatch = () => {
      if (watchEnded) return;
      watchEnded = true;
      beacon.send('watch_end', { level: proof.level });
    };
    const frame = (ts: number) => {
      const t = Math.round(ts);
      const dt = last < 0 ? 0 : Math.min(t - last, 1000);
      last = t;
      watch.frame(dt);
      if (watch.finished()) endWatch();
      if (watch.session.tick !== seenTick || watch.restarts() !== seenRestarts) {
        // A run that starts again is a fresh start, so the effects do not carry their last picture over.
        if (seenRestarts !== -1 && watch.restarts() !== seenRestarts) painter.reset();
        seenTick = watch.session.tick;
        seenRestarts = watch.restarts();
        tellParent(watch.session.tick, watch.restarts());
        painter.setScene(def.view(watch.session.state, viewport), t);
      }
      painter.paint(t);
      const mark = watch.mark();
      view.setMark(mark && mark.anchor ? boxForAnchor(view.root, def.view(watch.session.state, viewport), mark.anchor) : null);
      view.setStatus({ tick: watch.session.tick, phase: watch.session.status().phase, hash: watch.session.hash() });
      raf = win.requestAnimationFrame(frame);
    };
    raf = win.requestAnimationFrame(frame);
    stopLoop = () => {
      win.cancelAnimationFrame(raf);
      endWatch();
    };
  }

  function nextLevelId(levelId: string): string | null {
    const i = levels.findIndex((l) => l.id === levelId);
    return levels[i + 1]?.id ?? null;
  }

  function render(route: Route): void {
    leavePlay();
    leaveLevelFor(route);
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
            ...(options.tagline ? { tagline: options.tagline } : {}),
            ...(theme.garland ? { garland: { lit: theme.garland.lit, unlit: theme.garland.unlit, finished: levels.map((l) => store.isFinished(l.id)) } } : {}),
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
            facts: (id) => levelFacts.get(id),
            kind: def.kind,
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
            onToggle: (name, value) => {
              if (name === 'sound') audio.setSound(value);
              else if (name === 'music') audio.setMusic(value);
              else store.setSetting('usage', value);
            },
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
        container.replaceChildren(backdrop.sky, backdrop.rail);
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
