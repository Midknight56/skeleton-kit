import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The product name of a game lives only in its game.config.ts. A page writes __GAME_TITLE__ where the
// name goes, and the build puts the title from game.config.ts of the page folder there.
function gameTitle(): Plugin {
  let root = '';
  return {
    name: 'kit-game-title',
    configResolved(config) {
      root = config.root;
    },
    transformIndexHtml(html) {
      if (!html.includes('__GAME_TITLE__')) return html;
      const file = join(root, 'game.config.ts');
      if (!existsSync(file)) throw new Error(`${file} is missing, and the page asks for __GAME_TITLE__.`);
      const title = /title:\s*'([^']+)'/.exec(readFileSync(file, 'utf8'))?.[1];
      if (!title) throw new Error(`${file} has no title.`);
      return html.replaceAll('__GAME_TITLE__', escapeHtml(title));
    },
  };
}

// The build runs through `tools/build.mjs`, which sets `root` and `build.outDir` for each page.
// Every page uses a relative base, so the site works under any path.
export default defineConfig({
  base: './',
  plugins: [gameTitle()],
  build: {
    target: 'es2022',
    sourcemap: false,
    emptyOutDir: true,
  },
});
