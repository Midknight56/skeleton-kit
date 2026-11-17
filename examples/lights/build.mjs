// Bundles the definition and the prover options into ES modules for the prover and the tool door.
// kit/core points at TypeScript source with extensionless imports, so plain node cannot load it.
import { fileURLToPath, URL } from 'node:url';
import { build } from 'esbuild';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

for (const [entry, out] of [
  ['src/def.ts', 'dist/def.js'],
  ['src/proof.ts', 'dist/proof.js'],
]) {
  await build({
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'warning',
    entryPoints: [here(entry)],
    outfile: here(out),
  });
  process.stdout.write(`built ${out}\n`);
}
