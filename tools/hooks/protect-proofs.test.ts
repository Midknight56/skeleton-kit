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
});
