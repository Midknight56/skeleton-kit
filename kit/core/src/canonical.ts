import { KitError } from './errors';
import type { Json } from './types';

function describe(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return 'a function';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'symbol') return 'a symbol';
  if (typeof value === 'bigint') return 'a bigint';
  return Object.prototype.toString.call(value).slice(8, -1);
}

function fail(value: unknown, path: string): never {
  throw new KitError('not_plain_data', `Value at ${path} is not plain data: ${describe(value)}`, path);
}

function write(value: unknown, path: string, parents: unknown[]): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) return fail(value, path);
      return String(value);
    case 'object':
      break;
    default:
      return fail(value, path);
  }
  if (parents.includes(value)) {
    throw new KitError('not_plain_data', `Value at ${path} refers back to a parent`, path);
  }
  parents.push(value);
  let text: string;
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (let i = 0; i < value.length; i++) parts.push(write(value[i], `${path}[${i}]`, parents));
    text = `[${parts.join(',')}]`;
  } else {
    const proto: unknown = Object.getPrototypeOf(value);
    const tag = Object.prototype.toString.call(value);
    if (tag !== '[object Object]' || (proto !== Object.prototype && proto !== null)) return fail(value, path);
    const record = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of Object.keys(record).sort()) {
      parts.push(`${JSON.stringify(key)}:${write(record[key], `${path}.${key}`, parents)}`);
    }
    text = `{${parts.join(',')}}`;
  }
  parents.pop();
  return text;
}

/** Canonical JSON text: sorted keys, no spaces. Throws KitError `not_plain_data` with the path of a bad value. */
export function canonicalJson(value: Json): string {
  return write(value, '$', []);
}
