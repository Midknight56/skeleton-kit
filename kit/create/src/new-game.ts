// The new:game command. It copies the template of kit/create into apps/<id> and lists the new game in
// kit.config.json. It uses only the Node standard library, and it changes nothing when the id is bad.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

export interface NewGameResult {
  code: 0 | 1;
  // Lines for standard output.
  out: string[];
  // Lines for standard error.
  err: string[];
}

const ID = /^[a-z0-9][a-z0-9-]*$/;
const CONFIG = 'kit.config.json';

// The template sits next to this package. From the bundled command, `../template` is the same folder.
const defaultTemplate = fileURLToPath(new URL('../template', import.meta.url));

function fail(...err: string[]): NewGameResult {
  return { code: 1, out: [], err };
}

function templateFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap((entry) => (entry.isDirectory() ? templateFiles(join(dir, entry.name)) : [join(dir, entry.name)]));
}

// "my-lights" becomes "My lights". This is the product name in game.config.ts, the only place for it.
export function titleOf(id: string): string {
  const words = id.split('-').filter((word) => word !== '');
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// UTF-8, no byte order mark, LF line endings, one new line at the end.
function clean(text: string): string {
  const body = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  return body.endsWith('\n') ? body : `${body}\n`;
}

function configText(config: { games: string[] } & Record<string, unknown>): string {
  const { games, ...rest } = config;
  if (Object.keys(rest).length === 0) return `{\n  "games": [${games.map((g) => JSON.stringify(g)).join(', ')}]\n}\n`;
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function newGame(root: string, id: string | undefined, templateDir: string = defaultTemplate): NewGameResult {
  if (id === undefined || !ID.test(id)) {
    return fail(`The id ${JSON.stringify(id ?? '')} is not valid. Use lower case letters, digits and "-", and start with a letter or a digit.`, 'Usage: npm run new:game -- <id>');
  }
  const configPath = join(root, CONFIG);
  if (!existsSync(configPath)) return fail(`${CONFIG} was not found in ${root}.`);
  let config: { games: string[] } & Record<string, unknown>;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8')) as typeof config;
  } catch (error) {
    return fail(`${CONFIG} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Array.isArray(config.games) || config.games.some((game) => typeof game !== 'string')) {
    return fail(`${CONFIG} must hold {"games": [list of game folders]}.`);
  }
  const folder = `apps/${id}`;
  const inUse = config.games.some((game) => game === folder || game.split('/').at(-1) === id);
  if (inUse || existsSync(join(root, 'apps', id))) return fail(`The id "${id}" is in use: ${folder} or a game of ${CONFIG} has it already.`);
  if (!existsSync(templateDir)) return fail(`The template folder ${templateDir} was not found.`);

  // Build every file in memory first, so that nothing is written when a template file cannot be read.
  const title = titleOf(id);
  const created: { path: string; text: string }[] = [];
  for (const file of templateFiles(templateDir)) {
    const name = relative(templateDir, file).split('\\').join('/');
    if (!name.endsWith('.tpl')) continue;
    const text = readFileSync(file, 'utf8').replaceAll('__ID__', id).replaceAll('__TITLE__', title);
    created.push({ path: join(root, 'apps', id, name.slice(0, -'.tpl'.length)), text: clean(text) });
  }
  const nextConfig = configText({ ...config, games: [...config.games, folder] });

  for (const file of created) {
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.text, 'utf8');
  }
  writeFileSync(configPath, nextConfig, 'utf8');

  return {
    code: 0,
    out: [`Created ${folder} with ${created.length} files and listed it in ${CONFIG}.`, 'Next:', '  npm install', '  npm run prove', '  npm run verify'],
    err: [],
  };
}
