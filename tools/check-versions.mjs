// The version guard: every package.json of the repository stays below 1.0.0.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const skipped = new Set(['node_modules', 'dist', '.git']);

function packageFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skipped.has(entry.name)) found.push(...packageFiles(join(dir, entry.name)));
    } else if (entry.name === 'package.json') {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

// Returns one line for each package.json whose major version is 1 or more.
export function checkVersions(root) {
  const problems = [];
  for (const file of packageFiles(root)) {
    const name = relative(root, file).split('\\').join('/');
    let version;
    try {
      version = JSON.parse(readFileSync(file, 'utf8')).version;
    } catch {
      problems.push(`${name}: the file is not valid JSON`);
      continue;
    }
    if (typeof version !== 'string') continue;
    const major = Number.parseInt(version.split('.')[0] ?? '', 10);
    if (!Number.isFinite(major) || major >= 1) problems.push(`${name}: version ${version} is not below 1.0.0`);
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)));
  const problems = checkVersions(root);
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  process.exit(problems.length === 0 ? 0 : 1);
}
