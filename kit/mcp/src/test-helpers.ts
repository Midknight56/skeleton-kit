import { expect } from 'vitest';
import type { GameDef, Json } from '@kit/core';
import { createStore } from './store';
import type { ToolContext, ToolResult } from './tools';

export function makeContext(def: unknown, appDir = '.'): ToolContext {
  return { def: def as GameDef<Json, unknown>, store: createStore(), appDir };
}

export function okValue(result: ToolResult): Record<string, unknown> {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  return (result as { ok: true; value: Record<string, unknown> }).value;
}

export function okText(result: ToolResult): string {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  return (result as { ok: true; text: string }).text;
}

export function errorCode(result: ToolResult): string {
  expect(result.ok).toBe(false);
  return (result as { ok: false; error: string }).error;
}
