// Builds every game of kit.config.json that sits under apps/ with its own `build` script.
// A game outside apps/ (a test fixture) has no build script of its own and is skipped.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function appFolders(config) {
  return (config.games ?? []).filter((folder) => /^apps\/[a-z0-9-]+$/.test(folder));
}

export function buildApps() {
  const config = JSON.parse(readFileSync(join(root, 'kit.config.json'), 'utf8'));
  for (const folder of appFolders(config)) {
    const pkg = join(root, folder, 'package.json');
    if (!existsSync(pkg)) throw new Error(`${folder}: package.json is missing`);
    const scripts = JSON.parse(readFileSync(pkg, 'utf8')).scripts ?? {};
    if (!scripts.build) throw new Error(`${folder}: package.json has no build script`);
    process.stdout.write(`building ${folder}\n`);
    const bin = join(root, 'node_modules', '.bin');
    const result = spawnSync(scripts.build, {
      cwd: join(root, folder),
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` },
    });
    if (result.status !== 0) throw new Error(`${folder}: the build script failed`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    buildApps();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
