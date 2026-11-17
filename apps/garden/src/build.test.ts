import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateDef, type GameDef, type Json } from '@kit/core';
import { describe, expect, it } from 'vitest';

// These tests read the built files. `npm run build:apps` makes them, and `npm run verify` runs it first.
const dist = (name: string): string => fileURLToPath(new URL(`../dist/${name}`, import.meta.url));

// Importing a bundled file can take over 5 s while the whole suite runs in parallel.
describe('the built files', { timeout: 30_000 }, () => {
  it('has dist/def.js and dist/proof.js', () => {
    expect(existsSync(dist('def.js')), 'dist/def.js is missing. Run npm run build:apps.').toBe(true);
    expect(existsSync(dist('proof.js')), 'dist/proof.js is missing. Run npm run build:apps.').toBe(true);
  });

  it('exports the definition as the default of dist/def.js', async () => {
    const module = (await import(pathToFileURL(dist('def.js')).href)) as { default: GameDef<Json, unknown> };
    expect(module.default.id).toBe('garden');
    expect(validateDef(module.default)).toEqual([]);
  });

  it('exports turnOptions and levelChecks from dist/proof.js', async () => {
    const module = (await import(pathToFileURL(dist('proof.js')).href)) as Record<string, unknown>;
    expect(typeof module.levelChecks).toBe('function');
    expect(typeof module.turnOptions).toBe('object');
  });
});
