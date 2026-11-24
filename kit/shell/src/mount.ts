import type { GameDef, Json, Scene, Status, Viewport } from '@kit/core';
import { expandActions } from '@kit/core';
import { createAudio } from './audio';
import { createBeacon } from './beacon';
import { createBackdrop } from './screens/backdrop';
import type { EffectFactory } from './effects';
import { watchLeftMessage, watchMessage } from './watch-message';
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
import { watchCanvasTop, watchLayout, watchScreen, type WatchScreenView } from './screens/watch-screen';
import { parseWatchParam, createWatch, type WatchController } from './watch';
import { parseOpenParam } from './open-param';
import { neighbourLevels } from './watch-nav';
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
  // The state that was last put into words for a screen reader.
  heard: S;
}

const WIN_FLASH_MS = 120;
// The old menu card lifts out in this time.
const LIFT_OUT_MS = 300;
const LOSE_SHAKE_MS = 240;
// How long the reason for a refused press stays on screen.
const REFUSED_MS = 3000;

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
  // Shows why a key did nothing, beside the button of that action. Set by the play screen that is open.
  let refuseKey: ((key: string) => boolean) | null = null;
  // Stops the loop of the open play or watch screen. With keep the screen is only drawn again, so nothing ends.
  let stopLoop: ((keep?: boolean) => void) | null = null;
  // The open watch screen, so a resize can draw it again for the new size and keep its run.
  let watching: { proof: ProofFile; watch: WatchController<S, A> } | null = null;
  let watchView: WatchScreenView | null = null;
  let watchEndSent = false;
  // The size the open play or watch screen was laid out for.
  let builtSize = '';
  // Puts the state of the open play screen into words for a screen reader. Set by the play screen that is open.
  let announceNow: () => void = () => undefined;
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
  else if (parseOpenParam(options.search ?? '') === 'settings') router.replace('settings');
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

  // The words of the game for a screen reader. A game without its own gives the observation summary of a turn game.
  function words(state: S, previous: S | null, status: Status): string | null {
    if (input.narrate) return input.narrate(state, previous, status);
    return def.kind === 'turn' ? def.observe(state).summary : null;
  }

  function leavePlay(keep = false): void {
    stopLoop?.(keep);
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
    builtSize = `${W}x${H}`;
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
          if (active?.play.undo()) {
            audio.play('tap');
            announceNow();
            // The lesson on screen is the one for the turn the board is back at.
            if (shown.length > 0) {
              queue = shown.slice(active.play.session.tick);
              showNextLesson();
            }
          }
        },
        button: (action) => {
          const a = active;
          if (!a) return;
          if (a.play.press(action)) return;
          // A press that the rules refuse says why, beside its button, when the game gives a reason.
          const why = a.play.session.status().phase === 'playing' ? (input.refused?.(action, a.play.session.state) ?? null) : null;
          const spec = input.buttons.find((b) => b.action === action);
          if (why && spec) showRefused(spec.id, why);
        },
      },
    });
    const canvasHeight = H - stripHeight(scale, safe.bottom);
    const viewport: Viewport = { width: W, height: canvasHeight, safe: { top: safe.top, right: safe.right, bottom: 0, left: safe.left } };
    let hints: Hints | null = null;
    let refusedNote: Hints | null = null;
    let shown: Lesson[] = [];
    // The lessons of a level show one at a time: the first at the start, the next after each move.
    let queue: Lesson[] = [];
    let painter: Painter;
    announceNow = () => {
      const a = active;
      if (!a) return;
      const session = a.play.session;
      view.setNarration(words(session.state, a.heard, session.status()));
      a.heard = session.state;
      syncUndo();
    };
    function syncUndo(): void {
      const undo = view.root.querySelector<HTMLButtonElement>('[data-control="undo"]');
      if (undo && active) undo.disabled = active.play.session.status().phase !== 'playing';
    }

    function placeHints(lessons: Lesson[]): Hints | null {
      const a = active;
      if (!a || lessons.length === 0) return null;
      // Chips stay below the counter text and above the strip, 12 px from the text and the buttons.
      const scene = a.play.scene();
      const hud = hudTextBoxes(scene);
      const buttons = Array.from(view.root.querySelectorAll<HTMLElement>('[data-control]')).map((el) => ({
        x: parseFloat(el.style.left),
        y: parseFloat(el.style.top),
        w: parseFloat(el.style.width),
        h: parseFloat(el.style.height),
      }));
      const foreground = scene.items.filter((item) => item.layer === 'world' || item.layer === 'actors');
      const obstacles = sceneBoxes({ ...scene, items: foreground }).map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
      if (def.kind === 'tick') {
        for (const lesson of lessons) {
          const item = sceneBoxes(scene).find((b) => b.id === lesson.anchor);
          if (item) {
            const reach = Math.round(item.h * 1.8);
            obstacles.push({ x: item.x - 20, y: item.y - reach, w: item.w + 40, h: reach });
          }
        }
      }
      return showHints(doc, view.root, lessons, (anchor) => boxForAnchor(view.root, scene, anchor), {
        width: W,
        height: H,
        safe,
        fontSize: theme.typeScale.small,
        scale,
        top: Math.max(0, ...hud.map((b) => b.y + b.h)),
        bottom: parseFloat(view.strip.style.top),
        avoid: [...hud, ...buttons],
        obstacles,
      });
    }

    function showNextLesson(): void {
      hints?.remove();
      hints = null;
      const next = queue.shift();
      if (next) hints = placeHints([next]);
    }

    function showRefused(anchor: string, text: string): void {
      refusedNote?.remove();
      refusedNote = placeHints([{ id: 'refused', anchor, text }]);
      const note = refusedNote;
      later(REFUSED_MS, () => {
        if (refusedNote === note) {
          note?.remove();
          refusedNote = null;
        }
      });
    }

    // A key that the rules cannot use now says why, as the button of that action does.
    refuseKey = (key) => {
      const a = active;
      if (!a || a.play.session.status().phase !== 'playing') return false;
      const why = input.refusedKey?.(key, a.play.session.state) ?? null;
      if (!why) return false;
      showRefused(why.anchor, why.text);
      return true;
    };

    if (!active || active.levelId !== levelId || active.result !== null) {
      const current: { value: ActivePlay<S, A> | null } = { value: null };
      const play = createPlay({
        def,
        input,
        levelId,
        viewport,
        hudScale: scale,
        onApplied: (text) => {
          refusedNote?.remove();
          refusedNote = null;
          // An idle tick of a tick game is not a move of the player, so the lesson on screen stays.
          if (!(def.kind === 'tick' && text === input.idle)) {
            if (current.value && current.value.play.session.status().phase === 'playing') showNextLesson();
            else {
              hints?.remove();
              hints = null;
            }
          }
          const a = current.value;
          if (!a) return;
          announceNow();
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
      const fresh: ActivePlay<S, A> = { levelId, levelIndex, play, start: play.session.state, score: 0, result: null, ended: false, heard: play.session.state };
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
    view.setNarration(words(current.play.session.state, null, current.play.session.status()));
    current.heard = current.play.session.state;
    syncUndo();
    show(view.root, false);
    // The chips are measured and placed once the screen is shown, because a hidden page has no layout.
    if (shown.length > 0) {
      queue = shown.slice();
      showNextLesson();
    }

    // The strip buttons whose action the rules refuse now are marked, so they look unavailable.
    const stripButtons = input.buttons
      .map((spec) => ({ spec, el: view.root.querySelector<HTMLElement>(`[data-control="${spec.id}"]`) }))
      .filter((b): b is { spec: (typeof input.buttons)[number]; el: HTMLElement } => b.el !== null);
    let blockedAt = -2;
    const markBlocked = () => {
      const legal = current.play.session.status().phase === 'playing' ? current.play.session.legal() : [];
      for (const b of stripButtons) b.el.dataset.blocked = String(!legal.includes(b.spec.action));
    };

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
      if (blockedAt !== lastTick) {
        blockedAt = lastTick;
        markBlocked();
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

  function startWatch(proof: ProofFile, kept?: WatchController<S, A>): void {
    const W = win.innerWidth;
    const H = win.innerHeight;
    builtSize = `${W}x${H}`;
    const safe = readSafe(doc);
    const watch =
      kept ??
      createWatch({
        def,
        input,
        texts,
        proof,
        onApplied: (previous, state) => watchView?.setNarration(words(state, previous, def.status(state))),
      });
    if (!kept) {
      watchEndSent = false;
      beacon.send('watch_start', { level: proof.level });
    }
    watching = { proof, watch };
    const nav = neighbourLevels(
      levels.map((l) => l.id),
      proofIndex ? new Set(proofIndex.levels.map((l) => l.id)) : null,
      proof.level,
    );
    const view: WatchScreenView = watchScreen(doc, {
      nav: { number: nav.number, hasPrev: nav.prev !== null, hasNext: nav.next !== null },
      width: W,
      height: H,
      safe,
      kind: def.kind,
      buttons: input.buttons,
      fontSize: theme.typeScale.body,
      on: {
        back: () => router.go('title'),
        level: (direction) => {
          const target = direction < 0 ? nav.prev : nav.next;
          if (target) router.replace('watch', { level: target });
        },
        speed: (n) => {
          watch.setSpeed(n);
          view.setSpeed(n);
        },
      },
    });
    watchView = view;
    view.setSpeed(watch.speed());
    const verdict = watch.verdict;
    const proofText = verdict.kind === 'unproved' ? null : verdict.text;
    const rows = watchLayout(W, H, safe, proofText, theme.typeScale.body, true);
    // The picture sits under the level row. Its own safe top is what is left of the proof line above it.
    const canvasTop = watchCanvasTop(W, safe, theme.typeScale.body, true);
    const viewport: Viewport = { width: W, height: H - 72 - safe.bottom - canvasTop, safe: { top: Math.max(0, rows.sceneSafe.top - canvasTop), right: safe.right, bottom: 0, left: safe.left } };
    // A box of the scene is in picture coordinates, a control is in screen coordinates.
    const markBox = (scene: Scene, anchor: string): Rect | null => {
      const item = sceneBoxes(scene).find((b) => b.id === anchor);
      if (item) return { x: item.x, y: item.y + canvasTop, w: item.w, h: item.h };
      return boxForAnchor(view.root, scene, anchor);
    };
    const painter = makePainter(view);
    view.setProof(proofText);
    view.setNarration(words(watch.session.state, null, watch.session.status()));
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
    const endWatch = () => {
      if (watchEndSent) return;
      watchEndSent = true;
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
        if (seenRestarts !== -1 && watch.restarts() !== seenRestarts) {
          painter.reset();
          view.setNarration(words(watch.session.state, null, watch.session.status()));
        }
        seenTick = watch.session.tick;
        seenRestarts = watch.restarts();
        tellParent(watch.session.tick, watch.restarts());
        painter.setScene(def.view(watch.session.state, viewport), t);
      }
      painter.paint(t);
      const mark = watch.mark();
      view.setMark(mark && mark.anchor ? markBox(def.view(watch.session.state, viewport), mark.anchor) : null);
      view.setStatus({ tick: watch.session.tick, phase: watch.session.status().phase, hash: watch.session.hash() });
      raf = win.requestAnimationFrame(frame);
    };
    raf = win.requestAnimationFrame(frame);
    stopLoop = (keep) => {
      win.cancelAnimationFrame(raf);
      if (!keep) {
        endWatch();
        // The page that holds this one in a frame hears that no level plays now.
        if (win.parent !== win && win.location.origin !== 'null') win.parent.postMessage(watchLeftMessage(), win.location.origin);
      }
    };
  }

  function nextLevelId(levelId: string): string | null {
    const i = levels.findIndex((l) => l.id === levelId);
    return levels[i + 1]?.id ?? null;
  }

  function render(route: Route): void {
    leavePlay();
    watching = null;
    watchView = null;
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
        const fresh = route.params.fresh === '1';
        if (fresh) active = null;
        startPlay(levelId);
        // The history entry no longer says fresh, so Back from Pause returns to this run and does not restart it.
        if (fresh) router.settle({ level: levelId });
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
            gameId: def.id,
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
        show(howScreen(doc, { lessons: input.lessons, keys: input.keys ?? [], howTo: input.howTo ?? [], onBack: () => router.go('title') }), true);
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
        // The index of proofs tells which levels the level controls may go to.
        const ready = proofIndex ? Promise.resolve() : proofs.loadIndex().then((index) => void (proofIndex = index), () => undefined);
        ready.then(() => proofs.load(levelId)).then(
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

  // A resize or a turn of the device lays the open play or watch screen out again. The game goes on.
  const onResize = () => {
    if (destroyed || builtSize === `${win.innerWidth}x${win.innerHeight}`) return;
    const route = router.current();
    if (route.screen === 'play' && active && active.result === null) {
      leavePlay(true);
      startPlay(active.levelId);
    } else if (route.screen === 'watch' && watching) {
      const { proof, watch } = watching;
      leavePlay(true);
      startWatch(proof, watch);
    }
  };
  win.addEventListener('resize', onResize);

  const onKey = (e: KeyboardEvent) => {
    if (router.current().screen !== 'play' || !active) return;
    if (e.key === 'Escape') {
      router.go('pause');
      return;
    }
    const focused = doc.activeElement?.tagName === 'BUTTON';
    // Space and Enter press the focused button. Every other key goes to the game.
    const buttonKey = focused && (e.key === ' ' || e.key === 'Enter');
    if (active.play.key(e.key, focused)) e.preventDefault();
    else if (!buttonKey && refuseKey?.(e.key)) e.preventDefault();
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
      win.removeEventListener('resize', onResize);
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
