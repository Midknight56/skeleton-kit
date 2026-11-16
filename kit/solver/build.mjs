// Bundles the prove command and each test fixture into self-contained ES modules.
// kit/core points at TypeScript source with extensionless imports, so plain node cannot load it.
import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { build } from 'esbuild';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

const common = { bundle: true, platform: 'node', format: 'esm', target: 'node20', logLevel: 'warning' };

const jobs = [
  { entry: 'src/prove.ts', out: 'dist/prove.js' },
  { entry: 'test-fixtures/sample-lights/def.ts', out: 'test-fixtures/sample-lights/dist/def.js' },
  { entry: 'test-fixtures/sample-hop/def.ts', out: 'test-fixtures/sample-hop/dist/def.js' },
  { entry: 'test-fixtures/no-hop/def.ts', out: 'test-fixtures/no-hop/dist/def.js' },
];

for (const job of jobs) {
  if (!existsSync(here(job.entry))) {
    process.stdout.write(`skipped ${job.entry}: the file does not exist yet\n`);
    continue;
  }
  await build({ ...common, entryPoints: [here(job.entry)], outfile: here(job.out) });
  process.stdout.write(`built ${job.out}\n`);
}
