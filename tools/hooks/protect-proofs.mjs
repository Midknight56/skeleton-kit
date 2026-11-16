// Blocks a write into proofs/. Reads all of STDIN. Exit 2 with one line on STDERR
// when the text holds a proofs path. Otherwise exit 0.
import { readFileSync } from 'node:fs';

const pattern = /(^|[\s"'`=:,([])proofs[\\/]|[\\/]proofs[\\/]/;

function strings(value, out) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
}

const text = readFileSync(0, 'utf8');
const candidates = [text];
try {
  candidates.push(...strings(JSON.parse(text), []));
} catch {
  // Not JSON. The raw text is checked alone.
}

if (candidates.some((c) => pattern.test(c))) {
  process.stderr.write('Blocked: proofs/ may only be changed by npm run prove.\n');
  process.exit(2);
}
process.exit(0);
