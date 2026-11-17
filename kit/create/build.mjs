// Bundles the command into one file, because plain node cannot load TypeScript with extensionless imports.
import { fileURLToPath, URL } from 'node:url';
import { build } from 'esbuild';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

await build({
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'warning',
  entryPoints: [here('src/cli.ts')],
  outfile: here('dist/cli.js'),
});
if (!process.argv.includes('--quiet')) process.stdout.write('built dist/cli.js\n');
