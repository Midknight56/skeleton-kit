import { runConformance } from '@kit/conformance';
import { createSession, validateDef, type GameDef, type Json } from '@kit/core';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../game.config';
import def from './def';
import { decodeAction, encodeAction } from './rules/step';

describe('the game definition', () => {
  it('has the id, the kind and the title of game.config.ts', () => {
    expect(def.id).toBe('__ID__');
    expect(def.kind).toBe('turn');
    expect(def.title).toBe(gameConfig.title);
  });

  it('is a valid definition', () => {
    expect(validateDef(def as unknown as GameDef<Json, unknown>)).toEqual([]);
  });

  it('has three levels, each one playing at the start', () => {
    expect(def.levels().map((level) => level.id)).toEqual(['l1', 'l2', 'l3']);
    for (const { id } of def.levels()) {
      const state = def.init(id, 1);
      expect(state.lamps.some((lamp) => lamp === 1), id).toBe(true);
      expect(def.status(state).phase).toBe('playing');
    }
  });

  it('wins the first level with one press of the middle lamp', () => {
    const session = createSession(def, 'l1', 1);
    expect(session.apply('press:1,1').ok).toBe(true);
    expect(session.status().phase).toBe('won');
  });

  it('reads back the action texts it writes, and refuses others', () => {
    for (const action of def.actions(def.init('l1', 1))) expect(decodeAction(encodeAction(action))).toEqual(action);
    for (const text of ['press:3,0', 'press:1', 'Press:1,1', '', 'none']) expect(decodeAction(text), text).toBeNull();
  });

  it('passes every property test of the kit', () => {
    const failing = runConformance(def)
      .filter((result) => !result.passed)
      .map((result) => `${result.name}: ${result.message ?? ''}`);
    expect(failing).toEqual([]);
  });
});
