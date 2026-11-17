// Bundles the definition into one ES module for the prover and the tool door.
// kit/core points at TypeScript source with extensionless imports, so plain node cannot load it.
import { fileURLToPath, URL } from 'node:url';
import { build } from 'esbuild';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

await build({
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'warning',
  entryPoints: [here('src/def.ts')],
  outfile: here('dist/def.js'),
});
process.stdout.write('built dist/def.js\n');
