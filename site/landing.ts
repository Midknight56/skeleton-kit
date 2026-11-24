// The landing page script. It reads the proof file of the garden puzzle level g03 from the built site and
// lists the tool calls that play that level. It follows the real watch screen in the frame: the watch
// screen posts how many actions it has applied, and the call that runs is marked. The turn limit try out
// runs the search of the kit in this page (see try-rule.ts).
import { SHIPPED_LIMIT, readLimit, tryLimit } from './try-rule';
import { buildCalls, isWatchLeft, readLevel, readProgress, runningIndex, type Call, type ProofFile } from './calls';

// The star field of the sky, at fixed places. A small generator keeps them the same on every visit.
function drawStars(): void {
  const sky = document.querySelector('.sky');
  if (!sky) return;
  let seed = 20240917;
  const next = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const dots: string[] = [];
  for (let i = 0; i < 70; i++) {
    const x = (next() * 100).toFixed(2);
    const y = (next() * 72).toFixed(2);
    const r = next() < 0.2 ? 1.2 : 0.9;
    const alpha = (0.3 + next() * 0.5).toFixed(2);
    dots.push(`<circle cx="${x}%" cy="${y}%" r="${r}" fill="#efe7d2" fill-opacity="${alpha}"/>`);
  }
  sky.innerHTML = `<svg class="stars" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" focusable="false">${dots.join('')}</svg>`;
}

function line(call: Call, index: number): HTMLLIElement {
  const li = document.createElement('li');
  li.dataset.call = call.name;
  const n = document.createElement('span');
  n.className = 'n';
  n.textContent = String(index + 1);
  const name = document.createElement('code');
  name.className = 'name';
  name.textContent = call.name;
  const body = document.createElement('code');
  body.textContent = ` ${JSON.stringify(call.input)}`;
  li.append(n, name, body);
  if (call.response !== undefined) {
    const resp = document.createElement('span');
    resp.className = 'resp';
    resp.textContent = `→ ${call.response}`;
    li.append(resp);
  }
  return li;
}

// Marks the call that runs. Before it the calls are done, after it they wait.
function mark(list: Element, running: number): void {
  Array.from(list.children).forEach((item, i) => {
    const li = item as HTMLElement;
    li.dataset.running = String(i === running);
    li.dataset.state = i < running ? 'done' : i === running ? 'running' : 'pending';
  });
}

function showProgress(applied: number, total: number): void {
  const count = document.querySelector('[data-count]');
  if (count) count.textContent = `action ${applied} of ${total}`;
  const dots = document.querySelector('[data-dots]');
  if (!dots) return;
  if (dots.children.length !== total) {
    dots.replaceChildren(...Array.from({ length: total }, () => document.createElement('i')));
  }
  Array.from(dots.children).forEach((dot, i) => ((dot as HTMLElement).dataset.done = String(i < applied)));
}

// The turn limit try out. It writes nothing but the result line and the field.
function setupTry(): void {
  const form = document.querySelector<HTMLFormElement>('[data-try="form"]');
  const field = document.querySelector<HTMLInputElement>('[data-try="limit"]');
  const restore = document.querySelector<HTMLButtonElement>('[data-try="restore"]');
  const out = document.querySelector<HTMLElement>('[data-try="result"]');
  if (!form || !field || !restore || !out) return;
  const show = (limit: number | null): void => {
    const result = limit === null ? null : tryLimit(limit);
    out.textContent = result ? result.text : 'Use a whole number of turns from 1 to 20.';
    out.dataset.won = result?.kind === 'won' ? 'true' : result?.kind === 'lost' ? 'false' : 'error';
    for (const name of ['count', 'hash'] as const) {
      if (result?.kind === 'won') out.dataset[name] = String(name === 'count' ? result.count : result.hash);
      else delete out.dataset[name];
    }
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    show(readLimit(field.value));
  });
  restore.addEventListener('click', () => {
    field.value = String(SHIPPED_LIMIT);
    show(SHIPPED_LIMIT);
  });
}

async function main(): Promise<void> {
  setupTry();
  drawStars();
  const list = document.querySelector('[data-calls]');
  if (!list) return;
  try {
    const response = await fetch('./proofs/garden/g03.json');
    if (!response.ok) throw new Error(String(response.status));
    const proof = (await response.json()) as ProofFile;
    list.replaceChildren(...buildCalls(proof).map(line));
    // The frame is the only page that may speak to this one.
    const frame = document.querySelector<HTMLIFrameElement>('iframe[data-frame="watch"]');
    const board = document.querySelector('.board');
    const title = document.querySelector('[data-caption-title]');
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin || event.source !== frame?.contentWindow) return;
      // The frame left the watch screen: the caption and the counter say nothing until a demo plays again.
      if (isWatchLeft(event.data)) {
        board?.setAttribute('data-demo', 'off');
        return;
      }
      const progress = readProgress(event.data);
      if (!progress) return;
      board?.setAttribute('data-demo', 'on');
      const level = readLevel(event.data);
      const number = level === null ? null : /(\d+)$/.exec(level)?.[1];
      if (title && number) title.textContent = `Moth Garden, level ${Number(number)}`;
      // The calls list is the list of the level of the proof. Another level does not mark it.
      if (level === proof.level) mark(list, runningIndex(progress.applied, progress.total));
      showProgress(progress.applied, progress.total);
    });
  } catch {
    const li = document.createElement('li');
    li.textContent = 'The calls could not be loaded.';
    list.replaceChildren(li);
  }
}

void main();
