import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

// Task 2 of .kiro/specs/landing-try-a-rule. The test reads the capture plan of tools/capture-hero.mjs.
// Importing the tool must start no browser and no server.

const TOOL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tools', 'capture-hero.mjs');

interface Frame { id: string; game: string; moment: string }

async function plan(): Promise<Frame[]> {
  const module = (await import(pathToFileURL(TOOL).href)) as { CAPTURE_PLAN?: Frame[] };
  return module.CAPTURE_PLAN ?? [];
}

describe('the capture plan of the README image', () => {
  it('holds three frames', async () => {
    expect((await plan()).length).toBe(3);
  });

  it('includes a real runner gameplay frame with the broom in the air', async () => {
    const frame = (await plan()).find((item) => item.game === 'runner');
    expect(frame, 'a runner frame').toBeDefined();
    expect(frame?.moment).toBe('mid jump');
  });

  it('keeps a garden frame with a lantern move', async () => {
    const frame = (await plan()).find((item) => item.game === 'garden' && item.moment === 'lantern move');
    expect(frame, 'a garden frame with a lantern move').toBeDefined();
  });
});
