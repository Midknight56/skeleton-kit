import { KitError } from './errors';

const MAX_RUN = 3600;

/** Turns `['a','a','a','b']` into `['a*3','b']`. A run longer than 3600 is split. Throws for a text that holds `*`. */
export function compressActions(actions: string[]): string[] {
  const items: string[] = [];
  let i = 0;
  while (i < actions.length) {
    const text = actions[i] as string;
    if (text.includes('*')) {
      throw new KitError('not_plain_data', `Action text at index ${i} holds "*"`, `[${i}]`);
    }
    let end = i + 1;
    while (end < actions.length && actions[end] === text) end++;
    let left = end - i;
    while (left > 0) {
      const n = Math.min(left, MAX_RUN);
      items.push(n === 1 ? text : `${text}*${n}`);
      left -= n;
    }
    i = end;
  }
  return items;
}

/** The reverse of `compressActions`. Returns a typed failure for a malformed item and never throws. */
export function expandActions(items: string[]): { ok: true; actions: string[] } | { ok: false; message: string } {
  const actions: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as string;
    const parts = item.split('*');
    if (parts.length === 1) {
      actions.push(item);
      continue;
    }
    if (parts.length > 2) return { ok: false, message: `Item ${i} has more than one "*"` };
    const text = parts[0] as string;
    const count = parts[1] as string;
    if (text === '') return { ok: false, message: `Item ${i} has no action text before "*"` };
    if (!/^[1-9][0-9]*$/.test(count)) return { ok: false, message: `Item ${i} has no valid count after "*"` };
    const n = Number(count);
    if (n < 2 || n > MAX_RUN) return { ok: false, message: `Item ${i} has count ${count}, which is not from 2 to ${MAX_RUN}` };
    for (let k = 0; k < n; k++) actions.push(text);
  }
  return { ok: true, actions };
}
