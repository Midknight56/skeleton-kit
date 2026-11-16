import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const script = new URL('./protect-proofs.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function run(input: string) {
  return spawnSync(process.execPath, [script], { input, encoding: 'utf8' });
}

describe('protect-proofs hook', () => {
  const blocked = [
    ['starts with proofs/', 'proofs/garden.json'],
    ['starts with proofs\\', 'proofs\\garden.json'],
    ['contains /proofs/', 'apps/garden/proofs/l1.json'],
    ['contains \\proofs\\', 'apps\\garden\\proofs\\l1.json'],
  ];
  for (const [name, path] of blocked) {
    it(`blocks a path that ${name}`, () => {
      const r = run(JSON.stringify({ path }));
      expect(r.status).toBe(2);
      expect(r.stderr.trim().split('\n')).toHaveLength(1);
      expect(r.stderr.length).toBeGreaterThan(0);
    });
  }

  it('allows a path outside proofs', () => {
    const r = run(JSON.stringify({ path: 'kit/core/src/types.ts' }));
    expect(r.status).toBe(0);
  });

  // The Pre Tool Use event shape from the Kiro hooks reference (hook types page):
  // hook_event_name, cwd, session_id, tool_name and tool_input. The reference does not name the path field of a
  // write tool. The write tools of this session take `path`, so the sample events use it.
  const preToolUse = (toolInput: Record<string, unknown>) =>
    JSON.stringify({ hook_event_name: 'PreToolUse', cwd: '/work', session_id: 'abc123-def456-789', tool_name: 'write', tool_input: toolInput });

  it('blocks a Pre Tool Use event whose target path is under proofs/', () => {
    const r = run(preToolUse({ path: 'proofs/sample-hop/h1.json', text: '{}' }));
    expect(r.status).toBe(2);
    expect(r.stderr.trim()).toBe('Blocked: proofs/ may only be changed by npm run prove.');
  });

  it('allows a Pre Tool Use event for another path even when the file content holds proofs/', () => {
    const r = run(preToolUse({ path: 'kit/solver/src/prove.ts', text: "writeFileSync(join(root, 'proofs/', name), text);\n// proofs/sample-hop/h1.json\n" }));
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
  });

  it('allows a Pre Tool Use event for another path when another field mentions proofs/', () => {
    const r = run(preToolUse({ path: 'docs/notes.md', oldStr: 'see proofs/a.json', newStr: 'see proofs/b.json' }));
    expect(r.status).toBe(0);
  });
});
