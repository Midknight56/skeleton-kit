import { defineConfig } from 'vite';

// The build runs through `tools/build.mjs`, which sets `root` and `build.outDir` for each page.
// Every page uses a relative base, so the site works under any path.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    emptyOutDir: true,
  },
});
