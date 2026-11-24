// The server of the power menu-contrast-preview. It offers one tool, preview_menu_contrast.
// mcp.json starts it from the checkout named by SKELETON_KIT_ROOT. It runs offline and writes no file.
import { Buffer } from 'node:buffer';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { build } from 'esbuild';
import { z } from 'zod';

// The schemas are loose on purpose. The handler checks each field and names the one that is wrong.
const any = (text) => z.unknown().optional().describe(text);

function answer(result) {
  return { isError: result.ok ? undefined : true, content: [{ type: 'text', text: JSON.stringify(result.ok ? result.value : result.error) }] };
}

// The colour calculation of the test and the two current themes, bundled in memory and loaded from a
// data URL. Nothing is written to disk. A `.svg` file is read as text, as the build of the games does.
// It is loaded on each call, so the answer follows the theme files as they are now.
async function loadLibrary(root) {
  const entry = [
    "export { measuredPairsOf } from './tests/a11y/contrast-pairs.ts';",
    "export { gardenTheme } from './apps/garden/theme.ts';",
    "export { runnerTheme } from './apps/runner/theme.ts';",
  ].join('\n');
  const result = await build({
    stdin: { contents: entry, resolveDir: root, loader: 'ts', sourcefile: 'menu-contrast-entry.ts' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    loader: { '.svg': 'text' },
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

function rootFolder() {
  const root = process.env.SKELETON_KIT_ROOT;
  if (!root) throw new Error('SKELETON_KIT_ROOT is not set.');
  return root;
}

const GAMES = ['garden', 'runner'];
const FIELDS = ['glow', 'background', 'surface', 'primary', 'secondary', 'accent', 'text', 'muted', 'danger'];

function bad(field, message) {
  return { ok: false, error: { error: 'bad_input', field, message } };
}

// Returns an error result that names the first wrong field, or null when the input is fine.
function check({ game, field, colour }) {
  if (typeof game !== 'string' || !GAMES.includes(game)) return bad('game', 'The field "game" must be "garden" or "runner".');
  if (typeof field !== 'string' || !FIELDS.includes(field)) return bad('field', `The field "field" must be "glow" or one of: ${FIELDS.slice(1).join(', ')}.`);
  const pattern = field === 'glow' ? /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/ : /^#[0-9a-fA-F]{6}$/;
  if (typeof colour !== 'string' || !pattern.test(colour)) {
    return bad('colour', field === 'glow' ? 'The field "colour" must be "#RRGGBB" or "#RRGGBBAA".' : 'The field "colour" must be "#RRGGBB" for a palette colour.');
  }
  return null;
}

async function preview(input) {
  const problem = check(input ?? {});
  if (problem) return problem;
  const { game, field, colour } = input;
  const library = await loadLibrary(rootFolder());
  const theme = game === 'garden' ? library.gardenTheme : library.runnerTheme;
  const proposed = JSON.parse(JSON.stringify(theme));
  if (field === 'glow') proposed.glow = colour;
  else proposed.palette[field] = colour;
  const before = library.measuredPairsOf(game, theme);
  const after = library.measuredPairsOf(game, proposed);
  // The ratios shown are cut to 2 decimals. Each result comes from the ratio at full precision.
  const rows = before.map((pair, i) => ({
    name: pair.name,
    currentRatio: pair.ratio,
    proposedRatio: after[i].ratio,
    minimum: pair.limit,
    currentResult: pair.result,
    proposedResult: after[i].result,
  }));
  const newFailures = rows.filter((r) => r.currentResult === 'pass' && r.proposedResult === 'fail').map((r) => r.name);
  const existingFailures = rows.filter((r) => r.currentResult === 'fail' && r.proposedResult === 'fail').map((r) => r.name);
  const current = field === 'glow' ? theme.glow : theme.palette[field];
  return { ok: true, value: { game, field, current, proposed: colour, pairsChecked: rows.length, newFailureCount: newFailures.length, newFailures, existingFailures, rows } };
}

async function main() {
  const server = new McpServer({ name: 'menu-contrast-preview', version: '0.1.0' });
  server.registerTool(
    'preview_menu_contrast',
    {
      description:
        'Try a theme colour before editing a file. Says which menu labels, icons and borders of the garden or runner fall below their contrast limit with the proposed colour. Changes no file.',
      inputSchema: {
        game: any('"garden" or "runner".'),
        field: any('"glow" or a colour name of Theme.palette: background, surface, primary, secondary, accent, text, muted, danger.'),
        colour: any('"#RRGGBB". For "glow" also "#RRGGBBAA".'),
      },
    },
    async (input) => {
      try {
        return answer(await preview(input));
      } catch (error) {
        process.stderr.write(`menu-contrast-preview: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
        return answer({ ok: false, error: { error: 'internal_error', message: 'The preview failed. The details are on standard error.' } });
      }
    },
  );
  process.stdin.on('end', () => {
    void server.close().then(() => process.exit(0));
  });
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  process.stderr.write(`menu-contrast-preview: unexpected failure: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
