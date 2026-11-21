import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Task 3 of .kiro/specs/readme-hero. The README write up says what the files say. The test reads files
// only. Every number it compares is read from a file when the test runs.

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts: string[]): string => readFileSync(join(REPO, ...parts), 'utf8');
const readme = read('README.md');

function lines(path: string[]): number {
  const all = read(...path).split('\n');
  return all[all.length - 1] === '' ? all.length - 1 : all.length;
}

function specs(): { name: string; tasks: number; done: number }[] {
  const root = join(REPO, '.kiro', 'specs');
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const text = read('.kiro', 'specs', entry.name, 'tasks.md');
      return {
        name: entry.name,
        tasks: [...text.matchAll(/^\s*- \[[ x]\]/gm)].length,
        done: [...text.matchAll(/^\s*- \[x\]/gm)].length,
      };
    });
}

function logRows(): string[] {
  return read('docs', 'kiro-log.md')
    .split('\n')
    .filter((line) => /^\| \d{4}-\d\d-\d\d \| Kiro /.test(line));
}

function leadOrder(leads: string[]): number[] {
  return leads.map((lead) => readme.indexOf(`**${lead}.**`));
}

function ascending(values: number[]): boolean {
  return values.every((value, i) => value >= 0 && (i === 0 || value > (values[i - 1] as number)));
}

describe('paths and forbidden words', () => {
  it('every docs/acceptance path written in backticks exists', () => {
    const paths = [...readme.matchAll(/`(docs\/acceptance\/[^`\s]+)`/g)].map((m) => m[1] as string);
    expect(paths.length).toBeGreaterThanOrEqual(8);
    for (const path of paths) expect(existsSync(join(REPO, path)), path).toBe(true);
  });

  it('says nothing of the kind "not used"', () => {
    expect(readme).not.toContain('Not used in this build');
    expect(readme).not.toContain('was not used');
    expect(readme.toLowerCase()).not.toContain('not used');
  });

  it('holds no dash between words', () => {
    expect(readme).not.toMatch(/\s[\u2013\u2014-]\s|[\u2013\u2014]/);
  });

  it('holds no word like fake or sandbox, and no claim of a user test', () => {
    expect(readme).not.toMatch(/\b(fake|fakes|faked|sandbox|sandboxed)\b/i);
    expect(readme).not.toMatch(/\b\d+ (people|users|players|testers|participants) (tested|played|tried)\b/i);
    expect(readme).not.toMatch(/\bplaytested by\b/i);
  });
});

describe('the order of the sections', () => {
  it('the judging block follows the picture and the links at once', () => {
    const top = readme.slice(0, readme.indexOf('\n## ')).split('\n').filter((line) => line.trim() !== '');
    expect(top[0]).toBe('# Skeleton kit');
    expect(top.slice(1).map((line) => line.split(/[ :]/)[0])).toEqual(['![The', 'Play', 'Video']);
    expect(readme).toMatch(/\n## Judging criteria at a glance\n/);
    expect(readme.indexOf('\n## ')).toBe(readme.indexOf('\n## Judging criteria at a glance\n'));
  });

  it('the five criteria come in the contest order', () => {
    const order = leadOrder(['Potential Impact', 'Technological Implementation', 'Design', 'Innovation/Idea', 'Presentation']);
    expect(ascending(order)).toBe(true);
    expect(order[0]).toBeGreaterThan(readme.indexOf('## Judging criteria at a glance'));
    expect(order[4]).toBeLessThan(readme.indexOf('\n## ', order[0]));
  });

  it('the Kiro write up follows the order of the contest questions, then spec against vibe and accessibility', () => {
    const leads = ['Kiro IDE', 'Kiro CLI', 'Kiro Web', 'Kiro Crew', 'Custom agents', 'Agent hooks', 'Spec driven development', 'Steering docs', 'MCP', 'Property based testing (PBT)', 'Kiro powers'];
    expect(ascending(leadOrder(leads))).toBe(true);
    const sections = [...readme.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    const how = sections.indexOf('How Kiro was used');
    expect(how).toBeGreaterThan(0);
    expect(sections.slice(how, how + 3)).toEqual(['How Kiro was used', 'Spec against vibe, and the model test', 'Accessibility']);
    expect(readme.match(/^## Accessibility$/gm)).toHaveLength(1);
    expect(readme).not.toMatch(/\*\*Accessibility\.\*\*/);
    expect(sections).not.toContain('Kiro Crew app');
  });
});

describe('numbers read from the files', () => {
  it('counts the specs, their tasks and says all are done', () => {
    const all = specs();
    const tasks = all.reduce((sum, spec) => sum + spec.tasks, 0);
    expect(all.every((spec) => spec.tasks === spec.done)).toBe(true);
    expect(readme).toContain(`${all.length} specs`);
    expect(readme).toContain(`${tasks} tasks`);
    const first = ['kit-core', 'tool-door-and-prover', 'garden-puzzle', 'broom-runner', 'shell-and-site'];
    expect(readme).toContain(`${all.filter((spec) => first.includes(spec.name)).reduce((sum, spec) => sum + spec.tasks, 0)} tasks`);
    for (const spec of all) expect(readme, spec.name).toContain('`' + spec.name + '`');
  });

  it('counts the rows of the log by surface', () => {
    const rows = logRows();
    const on = (prefix: string) => rows.filter((row) => row.split('|')[2]?.trim().startsWith(prefix)).length;
    expect(readme).toContain(`${rows.length} rows`);
    expect(readme).toContain(`${on('Kiro CLI 3.3.0')} on Kiro CLI 3.3.0`);
    expect(readme).toContain(`${on('Kiro CLI 3.5.0')} on Kiro CLI 3.5.0`);
    expect(readme).toContain(`${on('Kiro IDE')} in the Kiro IDE`);
    expect(on('Kiro CLI 3.3.0') + on('Kiro CLI 3.5.0') + on('Kiro IDE')).toBe(rows.length);
  });

  it('counts steering files, hooks, MCP servers and agents', () => {
    const count = (...parts: string[]) => readdirSync(join(REPO, ...parts)).length;
    const servers = Object.keys((JSON.parse(read('.kiro', 'settings', 'mcp.json')) as { mcpServers: object }).mcpServers).length;
    expect(count('.kiro', 'steering')).toBe(5);
    expect(readme).toContain('five steering files');
    expect(count('.kiro', 'hooks')).toBe(3);
    expect(count('.kiro', 'agents')).toBe(2);
    expect(servers).toBe(3);
    expect(readme).toContain('three hooks, three MCP servers, two custom agents and one power');
  });

  it('gives the level counts and ranges of the proof indexes', () => {
    for (const [game, count] of [['garden', 12], ['runner', 6]] as const) {
      const levels = (JSON.parse(read('proofs', game, 'index.json')) as { levels: { actions: number }[] }).levels;
      expect(levels).toHaveLength(count);
      const actions = levels.map((level) => level.actions);
      expect(readme).toContain(`${Math.min(...actions)} to ${Math.max(...actions)} actions`);
    }
    expect(readme).toMatch(/\| `apps\/garden` \| Moth Garden \| .* \| 12 \|/);
    expect(readme).toMatch(/\| `apps\/runner` \| Broom Runner \| .* \| 6 \|/);
  });

  it('gives the accessibility counts of the scan and the contrast check', () => {
    const report = JSON.parse(read('docs', 'acceptance', 'a11y', 'report.json')) as { scans: number; axeCoreVersion: string; totals: Record<string, number> };
    const contrast = JSON.parse(read('docs', 'acceptance', 'a11y', 'contrast.json')) as { pairs: number; failing: number; lowestRatio: { ratio: number } };
    expect(readme).toContain(`${report.scans} scans`);
    expect(readme).toContain(report.axeCoreVersion);
    expect(Object.values(report.totals).every((n) => n === 0)).toBe(true);
    expect(readme).toContain(`${contrast.pairs} pairs`);
    expect(contrast.failing).toBe(0);
    expect(readme).toContain(String(contrast.lowestRatio.ratio));
  });

  it('copies the numbers of the spec against vibe test and the model test', () => {
    const vibe = read('docs', 'acceptance', 'vibe-vs-spec', 'README.md');
    const model = read('docs', 'acceptance', 'model-test', 'README.md');
    for (const number of ['2.31', '7.88', '19.5', '30.9']) {
      expect(vibe, number).toContain(number);
      expect(readme, number).toContain(number);
    }
    for (const number of ['5.77', '10.47', '6.98', '18.1', '21.0', '33.0', '1234', '1237', '1229']) {
      expect(model, number).toContain(number);
      expect(readme, number).toContain(number);
    }
    expect(readme).toContain('`docs/acceptance/vibe-vs-spec/README.md`');
    expect(readme).toContain('`docs/acceptance/model-test/README.md`');
  });

  it('gives the length of docs/replay-format.md that the Kiro Web proof gives', () => {
    const proof = read('docs', 'acceptance', 'web-session', 'README.md');
    const length = lines(['docs', 'replay-format.md']);
    expect(proof).toContain(`${length} lines`);
    expect(readme).toContain(`${length} lines`);
  });
});

describe('the claims in the text', () => {
  it('names the IDE session proof and never says typecheck-on-save was not seen to fire', () => {
    expect(readme).toContain('`docs/acceptance/ide-session/`');
    expect(existsSync(join(REPO, 'docs', 'acceptance', 'ide-session', 'README.md'))).toBe(true);
    const sentences = readme.split(/(?<=\.)\s/).filter((s) => s.includes('typecheck-on-save'));
    expect(sentences.length).toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(sentence, sentence).not.toMatch(/no proof file|not named as fired|not seen to fire|was not seen|has not fired|not fired/i);
    }
  });

  it('names the hooks that fired with their proof files', () => {
    expect(readme).toContain('`docs/acceptance/hook-verify-on-stop.md`');
    expect(existsSync(join(REPO, 'docs', 'acceptance', 'hook-verify-on-stop.md'))).toBe(true);
    const sentence = readme.split(/(?<=\.)\s/).find((s) => s.includes('typecheck-on-save') && s.includes('seen to fire')) ?? '';
    expect(sentence).toContain('seen to fire');
    expect(readme).toContain('`docs/acceptance/ide-session/hook-process-log.txt`');
    expect(existsSync(join(REPO, 'docs', 'acceptance', 'ide-session', 'hook-process-log.txt'))).toBe(true);
    expect(read('docs', 'kiro-log.md')).toMatch(/\| typecheck-on-save \(PostFileSave\) \|/);
  });

  it('writes the Kiro Web task and the Crew app from their records', () => {
    expect(readme).toContain('https://github.com/Midknight56/skeleton-kit/pull/1');
    expect(readme).toContain('`docs/replay-format.md`');
    expect(readme).toContain('https://github.com/Midknight56/playcheck');
    expect(readme).toContain('Kiro Crew 0.12.2');
    expect(readme).toContain('20 Nov 2026');
    const crew = /\*\*Kiro Crew\.\*\*([\s\S]*?)\n\n/.exec(readme)?.[1] ?? '';
    expect(crew).toContain('Versions 0.1.0 and 0.2.0 were installed and run');
    expect(crew).toMatch(/0\.2\.1 was enabled/);
    expect(crew).toMatch(/ran twice on version 0\.2\.1/);
    expect(crew).toContain('46decffc1423863afb37ce4396f64c55e20c33cb');
    expect(crew).toContain('36.6 seconds');
    expect(crew).toContain('Run 5');
    expect(crew).toContain('"No new commit"');
    expect(crew).toContain('3.0 seconds');
    expect(crew).toContain("proof's own action lists");
    expect(crew).not.toMatch(/switched off\. It has not been run/);
    expect(crew).not.toMatch(/\bby hand\b/);
    expect(readme).not.toMatch(/0\.2\.1 is installed/);
    expect(readme).not.toMatch(/has not been run|not yet run/);
    expect(readme).not.toMatch(/won [^.]*\bby hand\b/);
  });

  it('says the two recorded IDE pieces of work, from the proof', () => {
    const ide = /\*\*Kiro IDE\.\*\*([\s\S]*?)\n\n/.exec(readme)?.[1] ?? '';
    expect(ide).toContain('`kit-core` task 12');
    expect(ide).toContain('16 Nov 2026');
    expect(ide).toContain('`garland-text`');
    expect(ide).toContain('`docs/acceptance/ide-session/`');
    expect(ide).toContain('npm run typecheck');
    expect(ide).toContain('Kiro.exe');
    expect(ide.length).toBeLessThan(2000);
  });

  it('writes the public number with its source and as a statement about competition only', () => {
    expect(readme).toContain('27,286 games have been released on Steam so far in 2026, against 21,185 in all of 2025');
    expect(readme).toContain('https://www.gamingonlinux.com/2026/11/steam-is-officially-drowning-in-game-releases/');
    expect(readme).toContain('2026-11-18');
    expect(readme).toContain('SteamDB');
    expect(readme).toMatch(/20 Nov 2026/);
  });

  it('puts the level facts in Potential Impact, as facts of the proof', () => {
    const impact = /\*\*Potential Impact\.\*\*([\s\S]*?)\n\n/.exec(readme)?.[1] ?? '';
    expect(impact).toContain('`proofs/garden/index.json`');
    expect(impact).toContain('`difficulty-display`');
    expect(impact).toMatch(/facts of the proof/);
  });

  it('puts the power, hooks, Web, Crew, spec against vibe, model test and accessibility in Technological Implementation', () => {
    const tech = /\*\*Technological Implementation\.\*\*([\s\S]*?)\n\n\*\*Design\.\*\*/.exec(readme)?.[1] ?? '';
    for (const part of ['power/skeleton-kit/', 'protect-proofs', 'verify-on-stop', 'pull/1', 'playcheck', 'docs/acceptance/vibe-vs-spec/', 'docs/acceptance/model-test/', 'docs/acceptance/a11y/']) {
      expect(tech, part).toContain(part);
    }
  });

  it('keeps the level facts paragraph right after the Innovation paragraph', () => {
    const paragraphs = readme.split(/\n\s*\n/);
    const innovation = paragraphs.findIndex((p) => p.startsWith('**Innovation/Idea.**'));
    expect(paragraphs[innovation + 1]).toContain('tools/level-facts.mjs');
  });
});
