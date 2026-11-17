// The command line of new:game: `node kit/create/dist/cli.js <id>`, run from the repository root.
import { newGame } from './new-game';

const result = newGame(process.cwd(), process.argv[2]);
for (const line of result.out) process.stdout.write(`${line}\n`);
for (const line of result.err) process.stderr.write(`${line}\n`);
process.exitCode = result.code;
