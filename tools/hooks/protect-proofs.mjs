// Blocks a write into proofs/. Reads all of STDIN, which holds the Pre Tool Use event as JSON
// (hook_event_name, cwd, session_id, tool_name, tool_input). Exit 2 with one line on STDERR when the
// target path of the write is under proofs/. Otherwise exit 0.
//
// Only the target path is checked. The text of the file and the other fields are not, so a file that
// mentions proofs/ (this script, its test, the prover) can still be written.
//
// The Kiro hooks reference does not name the path field of a write tool. The write tools of Kiro take
// `path`, so the script reads `tool_input.path`. It also reads a top level `path`, the shape of the
// first sample events in the test.
import { readFileSync } from 'node:fs';

const pattern = /^proofs[\\/]|[\\/]proofs[\\/]/;

function targetPath(event) {
  if (event === null || typeof event !== 'object') return undefined;
  const fromInput = event.tool_input && typeof event.tool_input === 'object' ? event.tool_input.path : undefined;
  const candidate = fromInput !== undefined ? fromInput : event.path;
  return typeof candidate === 'string' ? candidate : undefined;
}

let target;
try {
  target = targetPath(JSON.parse(readFileSync(0, 'utf8')));
} catch {
  // Not JSON. There is no target path to check.
}

if (target !== undefined && pattern.test(target.replace(/^\.[\\/]/, ''))) {
  process.stderr.write('Blocked: proofs/ may only be changed by npm run prove.\n');
  process.exit(2);
}
process.exit(0);
