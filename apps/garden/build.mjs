// Bundles the definition, the proof checks and the level search helper into self-contained ES modules.
// kit/core points at TypeScript source with extensionless imports, so plain node cannot load it.
import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { build } from 'esbuild';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

const common = { bundle: true, platform: 'node', format: 'esm', target: 'node20', logLevel: 'warning' };

const jobs = [
  { entry: 'src/def.ts', out: 'dist/def.js' },
  { entry: 'src/proof.ts', out: 'dist/proof.js' },
  { entry: 'tools/find-levels.ts', out: 'dist/find-levels.js' },
];

for (const job of jobs) {
  if (!existsSync(here(job.entry))) {
    process.stdout.write(`skipped ${job.entry}: the file does not exist yet\n`);
    continue;
  }
  await build({ ...common, entryPoints: [here(job.entry)], outfile: here(job.out) });
  process.stdout.write(`built ${job.out}\n`);
}
