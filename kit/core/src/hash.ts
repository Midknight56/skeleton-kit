import { canonicalJson } from './canonical';
import type { Json } from './types';

// TextEncoder is not part of the TypeScript standard library, so the UTF-8 bytes are made here.
// A lone surrogate becomes U+FFFD, as TextEncoder does.
function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

/** FNV-1a 64 bit over the UTF-8 bytes of `text`, as 16 lower case hex characters. */
export function fnv1a64(text: string): string {
  let h = OFFSET;
  for (const byte of utf8Bytes(text)) {
    h ^= BigInt(byte);
    h = (h * PRIME) & MASK;
  }
  return h.toString(16).padStart(16, '0');
}

/** A fingerprint of a state. It is for tests and proofs, not a security feature. */
export function hashState(state: Json): string {
  return fnv1a64(canonicalJson(state));
}
